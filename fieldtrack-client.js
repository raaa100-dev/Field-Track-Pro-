// ============================================================
// FieldTrack Pro — Supabase Client Library
// fieldtrack-client.js
//
// Install:  npm install @supabase/supabase-js
// Usage:    import { jobsApi, checkinsApi, ... } from './fieldtrack-client.js'
// ============================================================

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL   // or import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================================
// AUTH
// ============================================================

export const authApi = {
  /** Sign in with email + password */
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  },

  /** Sign out */
  async signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  },

  /** Get currently authenticated user + profile */
  async getCurrentUser() {
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    const { data: profile } = await supabase
      .from('profiles')
      .select('*, companies(*)')
      .eq('id', user.id)
      .single()
    return { user, profile }
  },

  /** Listen for auth state changes */
  onAuthChange(callback) {
    return supabase.auth.onAuthStateChange(callback)
  }
}

// ============================================================
// JOBS
// ============================================================

export const jobsApi = {
  /** Get all jobs (PMs see all; subs see assigned only via RLS) */
  async list(filters = {}) {
    let q = supabase
      .from('job_summary')   // uses our view with computed fields
      .select('*')
      .order('due_date', { ascending: true })

    if (filters.status)     q = q.eq('status', filters.status)
    if (filters.company_id) q = q.eq('company_id', filters.company_id)
    if (filters.is_overdue) q = q.eq('is_overdue', true)

    const { data, error } = await q
    if (error) throw error
    return data
  },

  /** Get single job with all related data */
  async get(jobId) {
    const { data, error } = await supabase
      .from('jobs')
      .select(`
        *,
        companies (*),
        job_workers (
          id, is_active, added_at,
          profiles:worker_id ( id, full_name, email, phone, role, is_lead )
        ),
        job_plans (*),
        parts_issued (*),
        job_checklist_items ( *, profiles:checked_by(full_name) ),
        pm_inspections (
          *, profiles:pm_id(full_name),
          pm_punch_list (*)
        ),
        change_orders (*),
        invoices (*),
        lien_waivers (*)
      `)
      .eq('id', jobId)
      .single()
    if (error) throw error
    return data
  },

  /** Create a new job */
  async create(jobData) {
    const { data, error } = await supabase
      .from('jobs')
      .insert(jobData)
      .select()
      .single()
    if (error) throw error
    await auditApi.log({ job_id: data.id, action: 'job_created', detail: { name: data.name } })
    return data
  },

  /** Update job fields */
  async update(jobId, updates) {
    const { data, error } = await supabase
      .from('jobs')
      .update(updates)
      .eq('id', jobId)
      .select()
      .single()
    if (error) throw error
    await auditApi.log({ job_id: jobId, action: 'job_updated', detail: updates })
    return data
  },

  /** Update job status */
  async updateStatus(jobId, status, completionDate = null) {
    const updates = { status }
    if (status === 'complete' && completionDate) {
      updates.completion_date = completionDate
    }
    return jobsApi.update(jobId, updates)
  },

  /** Geocode address and save GPS coords */
  async setGpsFromAddress(jobId, address) {
    // Use browser Geolocation or a geocoding service (e.g. Google Maps API)
    // Here we assume you've already resolved lat/lng
    const { data, error } = await supabase
      .from('jobs')
      .update({ address })
      .eq('id', jobId)
    if (error) throw error
    return data
  }
}

// ============================================================
// JOB WORKERS
// ============================================================

export const workersApi = {
  /** Add a worker to a job */
  async addToJob(jobId, workerId) {
    const { data, error } = await supabase
      .from('job_workers')
      .upsert({ job_id: jobId, worker_id: workerId, is_active: true }, { onConflict: 'job_id,worker_id' })
      .select()
      .single()
    if (error) throw error
    await auditApi.log({ job_id: jobId, action: 'worker_added', entity_id: workerId })
    return data
  },

  /** Remove a worker from a job */
  async removeFromJob(jobId, workerId) {
    const { error } = await supabase
      .from('job_workers')
      .update({ is_active: false })
      .eq('job_id', jobId)
      .eq('worker_id', workerId)
    if (error) throw error
    await auditApi.log({ job_id: jobId, action: 'worker_removed', entity_id: workerId })
  },

  /** Get all workers for a company */
  async listByCompany(companyId) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
    if (error) throw error
    return data
  }
}

// ============================================================
// CHECK-INS / GPS
// ============================================================

export const checkinsApi = {
  /**
   * Check in to a job — validates GPS via Supabase RPC
   * @param {string} jobId
   * @param {number} lat  - current GPS latitude
   * @param {number} lng  - current GPS longitude
   * @returns {{ success, checkin_id?, dist_ft, blocked?, error? }}
   */
  async checkIn(jobId, lat, lng) {
    const { data, error } = await supabase
      .rpc('gps_checkin', { p_job_id: jobId, p_lat: lat, p_lng: lng })
    if (error) throw error
    return data  // { success, checkin_id, dist_ft, message } or { success: false, error, blocked }
  },

  /**
   * Check out of a job
   */
  async checkOut(jobId, lat, lng) {
    const { data, error } = await supabase
      .rpc('gps_checkout', { p_job_id: jobId, p_lat: lat, p_lng: lng })
    if (error) throw error
    return data  // { success, hours_logged, message }
  },

  /** Get browser GPS coords (web / mobile) */
  async getBrowserGps() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'))
        return
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        err => reject(err),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    })
  },

  /** Get all active check-ins (live GPS dashboard) */
  async getActive() {
    const { data, error } = await supabase
      .from('active_checkins')
      .select('*')
    if (error) throw error
    return data
  },

  /** Get time log for a job (all workers, all dates) */
  async getJobTimelog(jobId) {
    const { data, error } = await supabase
      .from('worker_time_summary')
      .select('*')
      .eq('job_id', jobId)
      .order('work_date', { ascending: false })
    if (error) throw error
    return data
  },

  /** Subscribe to realtime check-in changes */
  subscribeToCheckins(jobId, callback) {
    return supabase
      .channel(`checkins:${jobId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'checkins',
        filter: `job_id=eq.${jobId}`
      }, callback)
      .subscribe()
  }
}

// ============================================================
// PHOTOS
// ============================================================

export const photosApi = {
  /**
   * Upload a GPS-tagged photo
   * @param {string} jobId
   * @param {File} file
   * @param {{ lat, lng, caption, stage, checkinId }} meta
   */
  async upload(jobId, file, { lat, lng, caption, stage, checkinId }) {
    // Get current user
    const { data: { user } } = await supabase.auth.getUser()

    // Upload file to Supabase Storage
    const ext = file.name.split('.').pop()
    const path = `jobs/${jobId}/photos/${Date.now()}-${user.id}.${ext}`
    const { error: storageError } = await supabase.storage
      .from('fieldtrack-photos')
      .upload(path, file, { upsert: false })
    if (storageError) throw storageError

    // Get job GPS for distance calc
    const { data: job } = await supabase
      .from('jobs')
      .select('gps_lat, gps_lng, gps_radius_ft')
      .eq('id', jobId)
      .single()

    const distFt = job?.gps_lat && lat
      ? calcDistanceFt(lat, lng, job.gps_lat, job.gps_lng)
      : null

    // Save photo record
    const { data, error } = await supabase
      .from('job_photos')
      .insert({
        job_id: jobId,
        checkin_id: checkinId || null,
        storage_path: path,
        caption,
        stage: stage || 'during',
        taken_by: user.id,
        photo_lat: lat,
        photo_lng: lng,
        dist_from_site_ft: distFt
      })
      .select()
      .single()
    if (error) throw error

    await auditApi.log({
      job_id: jobId, action: 'photo_uploaded',
      gps_lat: lat, gps_lng: lng,
      dist_from_site_ft: distFt,
      detail: { caption, stage, storage_path: path }
    })

    return data
  },

  /** Get public URL for a photo */
  getUrl(storagePath) {
    const { data } = supabase.storage
      .from('fieldtrack-photos')
      .getPublicUrl(storagePath)
    return data.publicUrl
  },

  /** List all photos for a job */
  async listForJob(jobId) {
    const { data, error } = await supabase
      .from('job_photos')
      .select('*, profiles:taken_by(full_name)')
      .eq('job_id', jobId)
      .order('taken_at', { ascending: false })
    if (error) throw error
    return data.map(p => ({ ...p, url: photosApi.getUrl(p.storage_path) }))
  }
}

// ============================================================
// PLAN MARKUP
// ============================================================

export const markupApi = {
  /** Save canvas markup data */
  async save(jobId, markupData, notes = '') {
    // Get next revision number
    const { data: last } = await supabase
      .from('plan_markups')
      .select('revision')
      .eq('job_id', jobId)
      .order('revision', { ascending: false })
      .limit(1)
      .single()
    const revision = (last?.revision || 0) + 1

    const { data, error } = await supabase
      .from('plan_markups')
      .insert({ job_id: jobId, markup_data: markupData, revision, notes })
      .select()
      .single()
    if (error) throw error

    await auditApi.log({ job_id: jobId, action: 'plan_markup_saved', detail: { revision } })
    return data
  },

  /** Get all markup revisions for a job */
  async listRevisions(jobId) {
    const { data, error } = await supabase
      .from('plan_markups')
      .select('*, profiles:created_by(full_name)')
      .eq('job_id', jobId)
      .order('revision', { ascending: false })
    if (error) throw error
    return data
  }
}

// ============================================================
// PARTS ISSUED
// ============================================================

export const partsApi = {
  async issue(jobId, partData) {
    const { data, error } = await supabase
      .from('parts_issued')
      .insert({ job_id: jobId, ...partData })
      .select()
      .single()
    if (error) throw error
    await auditApi.log({ job_id: jobId, action: 'part_issued', detail: partData })
    return data
  },

  async update(partId, updates) {
    const { data, error } = await supabase
      .from('parts_issued')
      .update(updates)
      .eq('id', partId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async listForJob(jobId) {
    const { data, error } = await supabase
      .from('parts_issued')
      .select('*, profiles:issued_by(full_name)')
      .eq('job_id', jobId)
    if (error) throw error
    return data
  }
}

// ============================================================
// CHECKLISTS
// ============================================================

export const checklistApi = {
  async check(itemId, checked) {
    const { data, error } = await supabase
      .from('job_checklist_items')
      .update({
        is_checked: checked,
        checked_by: checked ? (await supabase.auth.getUser()).data.user?.id : null,
        checked_at: checked ? new Date().toISOString() : null
      })
      .eq('id', itemId)
      .select()
      .single()
    if (error) throw error
    return data
  },

  async addItem(jobId, section, itemText) {
    const { data, error } = await supabase
      .from('job_checklist_items')
      .insert({ job_id: jobId, section, item_text: itemText })
      .select()
      .single()
    if (error) throw error
    return data
  }
}

// ============================================================
// PM INSPECTIONS
// ============================================================

export const inspectionsApi = {
  /** Create a new PM inspection visit */
  async create(jobId, { visitType, lat, lng, workObserved, qualityResult, issuesNoted, pmNotes, followupRequired, followupDate }) {
    const { data: job } = await supabase.from('jobs').select('gps_lat,gps_lng').eq('id', jobId).single()
    const distFt = job?.gps_lat && lat ? calcDistanceFt(lat, lng, job.gps_lat, job.gps_lng) : null

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('pm_inspections')
      .insert({
        job_id: jobId,
        pm_id: user.id,
        visit_type: visitType,
        visit_lat: lat,
        visit_lng: lng,
        dist_from_site_ft: distFt,
        work_observed: workObserved,
        quality_result: qualityResult,
        issues_noted: issuesNoted,
        pm_notes: pmNotes,
        followup_required: followupRequired,
        followup_date: followupDate
      })
      .select()
      .single()
    if (error) throw error

    await auditApi.log({ job_id: jobId, action: 'pm_inspection_created', gps_lat: lat, gps_lng: lng, dist_from_site_ft: distFt })
    return data
  },

  /** Approve a job (final sign-off) */
  async approve(inspectionId, jobId) {
    const { data, error } = await supabase
      .from('pm_inspections')
      .update({ approved_at: new Date().toISOString() })
      .eq('id', inspectionId)
      .select().single()
    if (error) throw error

    await jobsApi.update(jobId, { status: 'complete', completion_date: new Date().toISOString().split('T')[0] })
    await auditApi.log({ job_id: jobId, action: 'pm_signoff', detail: { inspection_id: inspectionId, result: 'approved' } })
    return data
  },

  /** Reject — send back for rework */
  async reject(inspectionId, jobId, reason) {
    const { data, error } = await supabase
      .from('pm_inspections')
      .update({ rejected_at: new Date().toISOString(), rejection_reason: reason })
      .eq('id', inspectionId)
      .select().single()
    if (error) throw error

    await jobsApi.update(jobId, { status: 'in_progress' })
    await auditApi.log({ job_id: jobId, action: 'pm_signoff', detail: { inspection_id: inspectionId, result: 'rejected', reason } })
    return data
  },

  /** Add punch list item */
  async addPunchItem(inspectionId, jobId, itemText) {
    const { data, error } = await supabase
      .from('pm_punch_list')
      .insert({ inspection_id: inspectionId, job_id: jobId, item_text: itemText })
      .select().single()
    if (error) throw error
    return data
  }
}

// ============================================================
// CHANGE ORDERS
// ============================================================

export const changeOrdersApi = {
  async create(jobId, { title, description, value, daysAdded }) {
    const { data, error } = await supabase
      .from('change_orders')
      .insert({ job_id: jobId, title, description, value, days_added: daysAdded, status: 'pending_sub' })
      .select().single()
    if (error) throw error
    await auditApi.log({ job_id: jobId, action: 'change_order_created', entity_id: data.id, detail: { title, value } })
    return data
  },

  async subSign(changeOrderId) {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('change_orders')
      .update({ status: 'signed', sub_signed_by: user.id, sub_signed_at: new Date().toISOString() })
      .eq('id', changeOrderId)
      .select().single()
    if (error) throw error
    await auditApi.log({ action: 'change_order_signed', entity_id: changeOrderId, detail: { signed_by: 'sub' } })
    return data
  }
}

// ============================================================
// AUDIT LOG
// ============================================================

export const auditApi = {
  async log({ job_id, action, entity_type, entity_id, gps_lat, gps_lng, dist_from_site_ft, detail, company_id }) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from('audit_log')
      .insert({
        job_id, user_id: user.id, company_id, action,
        entity_type, entity_id,
        gps_lat, gps_lng, dist_from_site_ft,
        detail
      })
    if (error) console.error('Audit log error:', error)
  },

  async query({ jobId, userId, action, limit = 100, offset = 0 }) {
    let q = supabase
      .from('audit_log')
      .select('*, profiles:user_id(full_name, company_id, companies:company_id(name))')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (jobId)  q = q.eq('job_id', jobId)
    if (userId) q = q.eq('user_id', userId)
    if (action) q = q.eq('action', action)

    const { data, error } = await q
    if (error) throw error
    return data
  }
}

// ============================================================
// REPORTS
// ============================================================

export const reportsApi = {
  /** Daily check-in summary for a date */
  async dailyCheckins(date = new Date().toISOString().split('T')[0]) {
    const { data, error } = await supabase.rpc('report_daily_checkins', { p_date: date })
    if (error) throw error
    return data
  },

  /** Job status report for a date range */
  async jobStatus(startDate, endDate) {
    const { data, error } = await supabase.rpc('report_job_status', {
      p_start: startDate,
      p_end: endDate
    })
    if (error) throw error
    return data
  },

  /** Sub performance summary */
  async subPerformance() {
    const { data, error } = await supabase.from('sub_performance_summary').select('*')
    if (error) throw error
    return data
  },

  /** Financial summary per job */
  async jobCosts(jobIds = null) {
    let q = supabase.from('job_cost_summary').select('*')
    if (jobIds) q = q.in('job_id', jobIds)
    const { data, error } = await q
    if (error) throw error
    return data
  },

  /** Compliance overview (counts of outstanding items) */
  async compliance() {
    const { data, error } = await supabase.from('compliance_overview').select('*').single()
    if (error) throw error
    return data
  }
}

// ============================================================
// REALTIME SUBSCRIPTIONS
// ============================================================

export const realtimeApi = {
  /** Subscribe to all active check-in changes for GPS dashboard */
  subscribeActiveCheckins(callback) {
    return supabase
      .channel('active_checkins')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'checkins' }, callback)
      .subscribe()
  },

  /** Subscribe to job status changes */
  subscribeJobStatus(jobId, callback) {
    return supabase
      .channel(`job_status_${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'jobs',
        filter: `id=eq.${jobId}`
      }, callback)
      .subscribe()
  },

  unsubscribe(channel) {
    supabase.removeChannel(channel)
  }
}

// ============================================================
// STORAGE HELPERS
// ============================================================

export const storageApi = {
  /** Upload a plan file */
  async uploadPlan(jobId, file) {
    const ext = file.name.split('.').pop()
    const path = `jobs/${jobId}/plans/${Date.now()}-${file.name}`
    const { error } = await supabase.storage
      .from('fieldtrack-plans')
      .upload(path, file)
    if (error) throw error

    const { data: { user } } = await supabase.auth.getUser()
    const { data, error: dbError } = await supabase
      .from('job_plans')
      .insert({
        job_id: jobId, file_name: file.name, storage_path: path,
        file_type: ext, file_size: file.size, uploaded_by: user.id
      })
      .select().single()
    if (dbError) throw dbError
    return data
  },

  getPlanUrl(path) {
    const { data } = supabase.storage.from('fieldtrack-plans').getPublicUrl(path)
    return data.publicUrl
  }
}

// ============================================================
// UTILITIES
// ============================================================

/** Calculate distance in feet between two GPS coordinates (Haversine) */
export function calcDistanceFt(lat1, lng1, lat2, lng2) {
  const R = 3958.8 * 5280  // Earth radius in feet
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2
    + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2) ** 2
  return Math.round(R * 2 * Math.asin(Math.sqrt(a)))
}

/** Format hours as "8h 45m" */
export function formatHours(h) {
  if (!h) return '0h'
  const hrs = Math.floor(h)
  const mins = Math.round((h - hrs) * 60)
  return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`
}

/** Check if a date is overdue */
export function isOverdue(dueDateStr, status) {
  if (!dueDateStr || ['complete', 'cancelled'].includes(status)) return false
  return new Date(dueDateStr) < new Date()
}
