// ============================================================
// FieldTrack Pro — Geocoding Module
// geocoding.js
//
// Converts a job site address → GPS lat/lng for the geofence.
// Supports Google Maps (recommended) and Mapbox as fallback.
// Also provides address autocomplete for the job creation form.
//
// Setup:
//   1. Pick a provider below (Google or Mapbox)
//   2. Add your API key to .env
//   3. Import geocodingApi into your job creation flow
// ============================================================

// ── ENV KEYS ──────────────────────────────────────────────
// Add ONE of these to your .env file:
//
//   NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
//   NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...
//
// Google Maps is recommended — better address accuracy for
// commercial/industrial addresses in Phoenix and other metros.
// Mapbox is a solid free-tier alternative.
// ──────────────────────────────────────────────────────────

const GOOGLE_KEY  = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

// ============================================================
// PROVIDER: Google Maps Geocoding API
// Docs: https://developers.google.com/maps/documentation/geocoding
// Free tier: $200/month credit (~40,000 geocodes free)
// ============================================================

async function geocodeWithGoogle(address) {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('address', address)
  url.searchParams.set('key', GOOGLE_KEY)

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Google Geocoding HTTP ${res.status}`)

  const json = await res.json()

  if (json.status === 'ZERO_RESULTS') {
    return null  // address not found
  }
  if (json.status !== 'OK') {
    throw new Error(`Google Geocoding error: ${json.status} — ${json.error_message || ''}`)
  }

  const result = json.results[0]
  const { lat, lng } = result.geometry.location

  return {
    lat,
    lng,
    formatted_address: result.formatted_address,
    place_id: result.place_id,
    components: parseGoogleComponents(result.address_components),
    provider: 'google',
    raw: result
  }
}

function parseGoogleComponents(components) {
  const get = (type) =>
    components.find(c => c.types.includes(type))?.long_name || ''
  return {
    street_number: get('street_number'),
    route:         get('route'),
    city:          get('locality'),
    state:         get('administrative_area_level_1'),
    zip:           get('postal_code'),
    country:       get('country')
  }
}

// ============================================================
// PROVIDER: Mapbox Geocoding API (fallback / free-tier option)
// Docs: https://docs.mapbox.com/api/search/geocoding
// Free tier: 100,000 geocodes/month
// ============================================================

async function geocodeWithMapbox(address) {
  const encoded = encodeURIComponent(address)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
    + `?access_token=${MAPBOX_TOKEN}`
    + `&country=us`
    + `&types=address`
    + `&limit=1`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`Mapbox Geocoding HTTP ${res.status}`)

  const json = await res.json()

  if (!json.features || json.features.length === 0) {
    return null  // address not found
  }

  const feature = json.features[0]
  const [lng, lat] = feature.center

  const ctx = {}
  ;(feature.context || []).forEach(c => {
    if (c.id.startsWith('place'))    ctx.city    = c.text
    if (c.id.startsWith('region'))   ctx.state   = c.text
    if (c.id.startsWith('postcode')) ctx.zip     = c.text
    if (c.id.startsWith('country'))  ctx.country = c.text
  })

  return {
    lat,
    lng,
    formatted_address: feature.place_name,
    place_id: feature.id,
    components: {
      street_number: feature.address || '',
      route: feature.text || '',
      city:  ctx.city  || '',
      state: ctx.state || '',
      zip:   ctx.zip   || '',
      country: ctx.country || ''
    },
    provider: 'mapbox',
    raw: feature
  }
}

// ============================================================
// MAIN GEOCODING API
// Auto-selects provider based on which key is configured.
// Falls back from Google → Mapbox if Google returns nothing.
// ============================================================

export const geocodingApi = {
  /**
   * Convert an address string to GPS coordinates.
   *
   * @param {string} address - Full address e.g. "1420 N 7th St, Phoenix AZ 85006"
   * @returns {{ lat, lng, formatted_address, components }} | null
   *
   * @example
   * const geo = await geocodingApi.geocode('1420 N 7th St, Phoenix AZ 85006')
   * // → { lat: 33.4482, lng: -112.0733, formatted_address: '...', ... }
   */
  async geocode(address) {
    if (!address?.trim()) throw new Error('Address is required')

    let result = null

    // Try Google first if key is available
    if (GOOGLE_KEY) {
      result = await geocodeWithGoogle(address)
      if (result) return result
    }

    // Fall back to Mapbox
    if (MAPBOX_TOKEN) {
      result = await geocodeWithMapbox(address)
      if (result) return result
    }

    if (!GOOGLE_KEY && !MAPBOX_TOKEN) {
      throw new Error(
        'No geocoding API key configured. '
        + 'Add NEXT_PUBLIC_GOOGLE_MAPS_KEY or NEXT_PUBLIC_MAPBOX_TOKEN to your .env'
      )
    }

    return null  // address genuinely not found
  },

  /**
   * Geocode an address and save the GPS coords directly to a job.
   * Call this after creating a job or when the PM updates the address.
   *
   * @param {import('./fieldtrack-client.js').supabase} supabase
   * @param {string} jobId
   * @param {string} address
   * @returns {{ lat, lng, formatted_address } | null}
   *
   * @example
   * const coords = await geocodingApi.geocodeAndSaveJob(supabase, jobId, '1420 N 7th St, Phoenix AZ 85006')
   * console.log(`Geofence set at ${coords.lat}, ${coords.lng}`)
   */
  async geocodeAndSaveJob(supabase, jobId, address) {
    const geo = await geocodingApi.geocode(address)

    if (!geo) {
      console.warn(`Could not geocode address: "${address}"`)
      return null
    }

    const { error } = await supabase
      .from('jobs')
      .update({
        address:          geo.formatted_address,
        gps_lat:          geo.lat,
        gps_lng:          geo.lng,
        city:             geo.components.city,
        state:            geo.components.state,
        zip:              geo.components.zip
      })
      .eq('id', jobId)

    if (error) throw error

    console.log(
      `✓ Geocoded "${address}" → ${geo.lat}, ${geo.lng} (${geo.provider})`
    )

    return {
      lat:               geo.lat,
      lng:               geo.lng,
      formatted_address: geo.formatted_address,
      provider:          geo.provider
    }
  },

  /**
   * Address autocomplete suggestions (for the address input field).
   * Returns up to 5 matching address suggestions as the user types.
   *
   * Uses Google Places Autocomplete (if Google key configured)
   * or Mapbox forward geocoding.
   *
   * @param {string} partial - Partial address typed by user
   * @param {string} [sessionToken] - Google session token (reuse per typing session)
   * @returns {Array<{ label, value, place_id }>}
   *
   * @example
   * const suggestions = await geocodingApi.autocomplete('1420 N 7th')
   * // → [{ label: '1420 N 7th St, Phoenix, AZ, USA', value: '1420 N 7th...', place_id: '...' }]
   */
  async autocomplete(partial, sessionToken = null) {
    if (!partial || partial.length < 3) return []

    if (GOOGLE_KEY) {
      return autocompleteGoogle(partial, sessionToken)
    }
    if (MAPBOX_TOKEN) {
      return autocompleteMapbox(partial)
    }
    return []
  }
}

// ── Google Places Autocomplete ─────────────────────────────

async function autocompleteGoogle(partial, sessionToken) {
  const url = new URL('https://maps.googleapis.com/maps/api/place/autocomplete/json')
  url.searchParams.set('input', partial)
  url.searchParams.set('key', GOOGLE_KEY)
  url.searchParams.set('types', 'address')
  url.searchParams.set('components', 'country:us')
  if (sessionToken) url.searchParams.set('sessiontoken', sessionToken)

  const res = await fetch(url)
  const json = await res.json()

  if (json.status !== 'OK' && json.status !== 'ZERO_RESULTS') return []

  return (json.predictions || []).map(p => ({
    label:    p.description,
    value:    p.description,
    place_id: p.place_id
  }))
}

// ── Mapbox Forward Geocoding (autocomplete) ────────────────

async function autocompleteMapbox(partial) {
  const encoded = encodeURIComponent(partial)
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encoded}.json`
    + `?access_token=${MAPBOX_TOKEN}`
    + `&country=us`
    + `&types=address`
    + `&autocomplete=true`
    + `&limit=5`

  const res = await fetch(url)
  const json = await res.json()

  return (json.features || []).map(f => ({
    label:    f.place_name,
    value:    f.place_name,
    place_id: f.id
  }))
}

// ============================================================
// REACT HOOK: useAddressAutocomplete
// Drop this into your New Job form for live address suggestions.
//
// Usage:
//   const { suggestions, loading, onInputChange, clearSuggestions }
//     = useAddressAutocomplete()
//
//   <input onChange={e => onInputChange(e.target.value)} />
//   {suggestions.map(s => <div onClick={() => onSelect(s.value)}>{s.label}</div>)}
// ============================================================

// NOTE: This section uses React hooks — only include if using React.
// Remove if using plain HTML/JS.

let _reactRef = null
try { _reactRef = await import('react') } catch {}  // graceful no-op if not in React env

export function useAddressAutocomplete(debounceMs = 300) {
  if (!_reactRef) {
    console.warn('useAddressAutocomplete requires React')
    return { suggestions: [], loading: false, onInputChange: () => {}, clearSuggestions: () => {} }
  }

  const { useState, useEffect, useRef, useCallback } = _reactRef

  const [suggestions, setSuggestions]   = useState([])
  const [loading, setLoading]           = useState(false)
  const debounceTimer                   = useRef(null)
  const sessionToken                    = useRef(crypto.randomUUID())  // new token per autocomplete session

  const onInputChange = useCallback((value) => {
    clearTimeout(debounceTimer.current)
    if (!value || value.length < 3) { setSuggestions([]); return }

    debounceTimer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const results = await geocodingApi.autocomplete(value, sessionToken.current)
        setSuggestions(results)
      } catch (e) {
        console.error('Autocomplete error:', e)
        setSuggestions([])
      } finally {
        setLoading(false)
      }
    }, debounceMs)
  }, [debounceMs])

  const clearSuggestions = useCallback(() => {
    setSuggestions([])
    sessionToken.current = crypto.randomUUID()  // reset session after selection
  }, [])

  useEffect(() => () => clearTimeout(debounceTimer.current), [])

  return { suggestions, loading, onInputChange, clearSuggestions }
}

// ============================================================
// PLAIN JS HELPER: addressInput
// For use with the existing FieldTrack-Pro.html (no framework).
// Attaches autocomplete + geocode behavior to an address <input>.
//
// Usage (in your HTML):
//   import { attachAddressInput } from './geocoding.js'
//   attachAddressInput({
//     inputEl:    document.getElementById('addressInput'),
//     dropdownEl: document.getElementById('addressDropdown'),
//     onSelect:   (address, lat, lng) => console.log(address, lat, lng)
//   })
// ============================================================

export function attachAddressInput({ inputEl, dropdownEl, onSelect }) {
  if (!inputEl || !dropdownEl) return

  let debounce = null

  inputEl.addEventListener('input', () => {
    const val = inputEl.value.trim()
    clearTimeout(debounce)
    dropdownEl.innerHTML = ''
    dropdownEl.style.display = 'none'

    if (val.length < 3) return

    debounce = setTimeout(async () => {
      const suggestions = await geocodingApi.autocomplete(val)
      if (!suggestions.length) return

      dropdownEl.innerHTML = ''
      suggestions.forEach(s => {
        const item = document.createElement('div')
        item.textContent = s.label
        item.style.cssText = `
          padding: 8px 12px; cursor: pointer; font-size: 12px;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          color: #8b93a8;
        `
        item.onmouseenter = () => item.style.background = 'rgba(59,130,246,0.1)'
        item.onmouseleave = () => item.style.background = ''
        item.onclick = async () => {
          inputEl.value = s.value
          dropdownEl.style.display = 'none'
          dropdownEl.innerHTML = ''

          // Geocode the selected address to get exact coords
          const geo = await geocodingApi.geocode(s.value)
          if (geo && onSelect) {
            onSelect(geo.formatted_address, geo.lat, geo.lng, geo.components)
          }
        }
        dropdownEl.appendChild(item)
      })

      dropdownEl.style.display = 'block'
    }, 300)
  })

  // Close dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
      dropdownEl.style.display = 'none'
    }
  })
}

// ============================================================
// INTEGRATION: New Job form — full geocode flow
//
// This is the complete workflow to wire into your job creation:
// ============================================================

/**
 * createJobWithGeocode
 *
 * Creates a job AND geocodes its address in one call.
 * Use this instead of jobsApi.create() when creating jobs.
 *
 * @example
 * const job = await createJobWithGeocode(supabase, {
 *   name:         'HVAC Replace #5',
 *   address:      '1420 N 7th St, Phoenix AZ 85006',
 *   company_id:   'uuid...',
 *   due_date:     '2026-05-10',
 *   budget:       8500,
 *   gps_radius_ft: 250
 * })
 */
export async function createJobWithGeocode(supabase, jobData) {
  // 1. Geocode the address
  const geo = await geocodingApi.geocode(jobData.address)

  if (!geo) {
    throw new Error(
      `Could not find GPS coordinates for address: "${jobData.address}". `
      + 'Please check the address and try again, or enter coordinates manually.'
    )
  }

  // 2. Merge geocoded fields into job data
  const enrichedJobData = {
    ...jobData,
    address:   geo.formatted_address,   // use the clean formatted version
    gps_lat:   geo.lat,
    gps_lng:   geo.lng,
    city:      geo.components.city  || jobData.city,
    state:     geo.components.state || jobData.state,
    zip:       geo.components.zip   || jobData.zip
  }

  // 3. Create the job
  const { data: job, error } = await supabase
    .from('jobs')
    .insert(enrichedJobData)
    .select()
    .single()
  if (error) throw error

  console.log(
    `✓ Job "${job.job_number}" created — geofence: ${geo.lat}, ${geo.lng} ±${job.gps_radius_ft}ft (${geo.provider})`
  )

  return {
    job,
    geocode: {
      lat:               geo.lat,
      lng:               geo.lng,
      formatted_address: geo.formatted_address,
      provider:          geo.provider
    }
  }
}

// ============================================================
// SUPABASE EDGE FUNCTION (server-side geocoding)
//
// For production, you should geocode server-side so your API
// key is never exposed in the browser. Deploy this as a
// Supabase Edge Function.
//
// File: supabase/functions/geocode/index.ts
// Deploy: supabase functions deploy geocode
// ============================================================

export const EDGE_FUNCTION_CODE = `
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_KEY = Deno.env.get('GOOGLE_MAPS_KEY')  // set as Supabase secret

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { address, job_id } = await req.json()
    if (!address) return new Response(JSON.stringify({ error: 'address required' }), { status: 400 })

    // Geocode
    const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
    url.searchParams.set('address', address)
    url.searchParams.set('key', GOOGLE_KEY)

    const geoRes = await fetch(url)
    const geoJson = await geoRes.json()

    if (geoJson.status !== 'OK' || !geoJson.results.length) {
      return new Response(JSON.stringify({ error: 'Address not found', status: geoJson.status }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { lat, lng } = geoJson.results[0].geometry.location
    const formatted = geoJson.results[0].formatted_address

    // Optionally update the job record
    if (job_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      )
      await supabase.from('jobs').update({ gps_lat: lat, gps_lng: lng, address: formatted }).eq('id', job_id)
    }

    return new Response(
      JSON.stringify({ lat, lng, formatted_address: formatted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
`
// To call from your frontend (replaces direct geocodingApi.geocode for production):
//
// const res = await supabase.functions.invoke('geocode', {
//   body: { address: '1420 N 7th St, Phoenix AZ', job_id: jobId }
// })
// const { lat, lng, formatted_address } = res.data
