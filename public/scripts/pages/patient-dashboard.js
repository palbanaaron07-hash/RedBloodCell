const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebarOverlay');
const toggle = document.getElementById('menuToggle');
const notificationBtn = document.getElementById('notificationBtn');
const notificationPanel = document.getElementById('notificationPanel');
const notificationPreviewCount = document.getElementById('notificationPreviewCount');
const headerProfileBtn = document.getElementById('headerProfileBtn');
const headerDropdown = document.getElementById('headerProfileDropdown');
const headerDropdownOverlay = document.getElementById('headerDropdownOverlay');
let boholMap = null;

function syncNotificationPreview() {
  const items = [...document.querySelectorAll('[data-notification-id]')];
  let savedState = { read: [], deleted: [] };
  try {
    savedState = JSON.parse(localStorage.getItem('veindropPatientNotificationState')) || savedState;
  } catch {
    // Use the default notification state when stored data is unavailable.
  }

  const readIds = Array.isArray(savedState.read) ? savedState.read : [];
  const deletedIds = Array.isArray(savedState.deleted) ? savedState.deleted : [];
  let visibleCount = 0;
  let unreadTotal = 0;

  items.forEach((item) => {
    const id = item.dataset.notificationId;
    const isDeleted = deletedIds.includes(id);
    const isUnread = item.classList.contains('unread') && !readIds.includes(id);
    item.classList.toggle('unread', isUnread);
    item.hidden = isDeleted || visibleCount >= 3;
    if (!isDeleted) visibleCount += 1;
    if (!isDeleted && isUnread) unreadTotal += 1;

    item.addEventListener('click', () => {
      const nextReadIds = [...new Set([...readIds, id])];
      localStorage.setItem('veindropPatientNotificationState', JSON.stringify({
        read: nextReadIds,
        deleted: deletedIds
      }));
    });
  });

  if (notificationPreviewCount) notificationPreviewCount.textContent = `${unreadTotal} new`;
  const notificationDot = notificationBtn?.querySelector('.notif-dot');
  if (notificationDot) notificationDot.hidden = unreadTotal === 0;
}

syncNotificationPreview();

function isMobileHeader() {
  return window.matchMedia('(max-width: 640px)').matches;
}

function focusBoholMap() {
  if (!boholMap || typeof L === 'undefined') return;

  const boholCenter = [9.8506, 124.1435];
  const boholBounds = L.latLngBounds(
    [9.30, 123.55],
    [10.35, 124.60]
  );
  const boholViewBounds = boholBounds.pad(0.06);

  boholMap.setView(boholCenter, 10);
  boholMap.fitBounds(boholViewBounds, { padding: [36, 36] });
  boholMap.panTo(boholCenter);
  boholMap.invalidateSize();
}

function addFacilityMarkers() {
  if (!boholMap || typeof L === 'undefined') return;

  const facilities = [
    {
      name: 'Governor Celestino Gallares Memorial Hospital',
      type: 'hospital',
      icon: 'fa-hospital',
      lat: 9.6556,
      lng: 123.8503,
      description: 'Main government hospital'
    },
    {
      name: 'Bohol Doctors Hospital',
      type: 'hospital',
      icon: 'fa-kit-medical',
      lat: 9.6542,
      lng: 123.8560,
      description: 'Private medical center'
    },
    {
      name: 'Bohol Blood Center',
      type: 'blood-bank',
      icon: 'fa-droplet',
      lat: 9.6590,
      lng: 123.8605,
      description: 'Blood collection and storage'
    },
    {
      name: 'Panglao Community Clinic',
      type: 'clinic',
      icon: 'fa-stethoscope',
      lat: 9.5795,
      lng: 123.7543,
      description: 'Primary care facility'
    },
    {
      name: 'Talibon District Hospital',
      type: 'emergency',
      icon: 'fa-truck-medical',
      lat: 10.1500,
      lng: 124.3180,
      description: 'Emergency medical support'
    },
    {
      name: 'Ubay Medical Station',
      type: 'clinic',
      icon: 'fa-user-doctor',
      lat: 10.0400,
      lng: 124.4700,
      description: 'Rapid care facility'
    }
  ];

  facilities.forEach((facility) => {
    const iconHtml = `<div class="facility-marker ${facility.type}"><i class="fa-solid ${facility.icon}"></i></div>`;
    const marker = L.marker([facility.lat, facility.lng], {
      icon: L.divIcon({
        className: 'facility-marker-wrapper',
        html: iconHtml,
        iconSize: [30, 30],
        iconAnchor: [15, 30]
      })
    }).addTo(boholMap);

    marker.bindPopup(`<strong>${facility.name}</strong><br/>${facility.description}`);
  });
}

function initBoholMap() {
  const mapContainer = document.getElementById('boholMap');
  if (!mapContainer || boholMap || typeof L === 'undefined') return;

  const boholCenter = [9.8506, 124.1435];
  const boholBounds = L.latLngBounds(
    [9.30, 123.55],
    [10.35, 124.60]
  );

  boholMap = L.map('boholMap', {
    center: boholCenter,
    zoom: 10,
    attributionControl: false,
    maxBounds: boholBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 10,
    maxZoom: 14,
    zoomControl: true,
    scrollWheelZoom: true,
    dragging: true,
    doubleClickZoom: true,
    touchZoom: true,
    boxZoom: true,
    keyboard: true
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18
  }).addTo(boholMap);

  const boholPin = L.divIcon({
    className: 'bohol-pin',
    html: '<span class="bohol-pin-dot"></span><span class="bohol-pin-label">Bohol</span>',
    iconSize: [88, 42],
    iconAnchor: [44, 36]
  });

  L.marker(boholCenter, { icon: boholPin }).addTo(boholMap).bindPopup('<strong>Bohol</strong><br/>Centered patient coverage area');

  window.setTimeout(() => {
    if (boholMap) {
      addFacilityMarkers();
      focusBoholMap();
    }
  }, 220);
}

function closeHeaderDropdown() {
  if (!headerDropdown) return;
  headerDropdown.classList.remove('active');
  if (headerDropdownOverlay) headerDropdownOverlay.classList.remove('active');
  if (headerProfileBtn) headerProfileBtn.setAttribute('aria-expanded', 'false');
}

function openHeaderDropdown() {
  if (!headerDropdown) return;
  headerDropdown.classList.add('active');
  if (isMobileHeader() && headerDropdownOverlay) {
    headerDropdownOverlay.classList.add('active');
  }
  if (headerProfileBtn) headerProfileBtn.setAttribute('aria-expanded', 'true');
}

function closeNotificationPanel() {
  if (!notificationPanel) return;
  notificationPanel.classList.remove('active');
  if (notificationBtn) notificationBtn.setAttribute('aria-expanded', 'false');
}

function openNotificationPanel() {
  if (!notificationPanel) return;
  notificationPanel.classList.add('active');
  if (notificationBtn) notificationBtn.setAttribute('aria-expanded', 'true');
}

function toggleNotificationPanel(event) {
  if (event) event.stopPropagation();
  if (!notificationPanel) return;
  const isOpen = notificationPanel.classList.contains('active');
  if (isOpen) {
    closeNotificationPanel();
    return;
  }
  closeHeaderDropdown();
  openNotificationPanel();
}

function syncSidebarState() {
  const isOpen = sidebar.classList.contains('open');
  const isMobile = window.matchMedia('(max-width: 900px)').matches;

  document.body.classList.toggle('menu-open', isMobile && isOpen);
  document.body.classList.toggle('desktop-sidebar-open', !isMobile && isOpen);

  if (overlay) {
    overlay.classList.toggle('active', isMobile && isOpen);
  }
}

function setSidebarOpen(isOpen) {
  sidebar.classList.toggle('open', isOpen);
  syncSidebarState();
  closeHeaderDropdown();
  closeNotificationPanel();
}

toggle.addEventListener('click', () => {
  setSidebarOpen(!sidebar.classList.contains('open'));
});

overlay.addEventListener('click', () => {
  setSidebarOpen(false);
});

// ---- Section-based Navigation ----
const sectionTitles = {
  dashboard: { title: 'Donor Center' },
  donor: { title: 'Donor Center' },
  requests: { title: 'Blood Requests' },
  drives: { title: 'Blood Drives' },
  profile: { title: 'My Profile' }
};

function activateSectionView(sectionName) {
  if (sectionName === 'donor') sectionName = 'dashboard';
  const target = document.getElementById('section-' + sectionName);
  if (!target) return null;

  document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
  target.classList.add('active');

  document.querySelectorAll('.nav-item[data-section]').forEach(n => n.classList.remove('active'));
  const activeNav = document.querySelector('.nav-item[data-section="' + sectionName + '"]');
  if (activeNav) activeNav.classList.add('active');

  document.querySelectorAll('.mobile-nav-item[data-mobile-section]').forEach((item) => {
    item.classList.remove('active');
    item.removeAttribute('aria-current');
  });
  const activeMobileNav = document.querySelector('.mobile-nav-item[data-mobile-section="' + sectionName + '"]');
  if (activeMobileNav) {
    activeMobileNav.classList.add('active');
    activeMobileNav.setAttribute('aria-current', 'page');
  }

  const info = sectionTitles[sectionName];
  if (info) {
    const titleEl = document.querySelector('.header-title h1');
    if (titleEl) titleEl.textContent = info.title;
    const subEl = document.querySelector('.header-title p');
    if (subEl) subEl.remove();
  }

  return target;
}

function navigateToSection(sectionName) {
  if (sectionName === 'donor') sectionName = 'dashboard';
  const target = document.getElementById('section-' + sectionName);
  if (!target) return;

  if (sectionName === 'requests' && currentProfile && !currentProfile.has_patient_profile) {
    openPatientView('requests');
    return;
  }

  activateSectionView(sectionName);

  // Keep refreshes on the section the user is currently viewing.
  const sectionHash = '#section-' + sectionName;
  if (window.location.hash !== sectionHash) {
    window.history.replaceState(null, '', sectionHash);
  }

  // Load section-specific data
  if (sectionName === 'drives') {
    renderBloodDrives();
  }

  if (sectionName === 'dashboard' || sectionName === 'donor') {
    loadDonorDashboard();
  }

  if (sectionName === 'dashboard' && boholMap) {
    window.setTimeout(() => {
      boholMap.invalidateSize();
      focusBoholMap();
    }, 180);
  }

  setSidebarOpen(false);
  window.scrollTo({ top: 0, behavior: 'auto' });
  window.requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  window.setTimeout(() => window.scrollTo({ top: 0, behavior: 'auto' }), 120);
}

document.querySelectorAll('.nav-item[data-section]').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    navigateToSection(item.dataset.section);
  });
});

document.querySelectorAll('.stat-card[data-stat-target]').forEach(card => {
  card.addEventListener('click', () => {
    navigateToSection(card.dataset.statTarget);
  });
});

document.querySelectorAll('.mobile-nav-item[data-mobile-section]').forEach(item => {
  item.addEventListener('click', () => {
    navigateToSection(item.dataset.mobileSection);
  });
});

const mobileDonorSearchBtn = document.getElementById('mobileDonorSearchBtn');
if (mobileDonorSearchBtn) {
  mobileDonorSearchBtn.addEventListener('click', openMobileDonorSearch);
}

const donorSearchAction = document.getElementById('donorSearchAction');
if (donorSearchAction) {
  donorSearchAction.addEventListener('click', searchDonorZones);
}

const linkedSection = window.location.hash.replace('#section-', '');
if (Object.prototype.hasOwnProperty.call(sectionTitles, linkedSection)) {
  activateSectionView(linkedSection);
  delete document.documentElement.dataset.initialSection;
  // Prevent the browser's native anchor jump from placing an SPA section
  // underneath the fixed mobile/PWA header. navigateToSection restores it.
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

window.addEventListener('hashchange', () => {
  const requestedSection = window.location.hash.replace('#section-', '');
  if (Object.prototype.hasOwnProperty.call(sectionTitles, requestedSection)) {
    navigateToSection(requestedSection);
  }
});

if (notificationBtn) {
  notificationBtn.addEventListener('click', toggleNotificationPanel);
}

window.addEventListener('resize', syncSidebarState);

window.addEventListener('resize', () => {
  if (boholMap) {
    boholMap.invalidateSize();
    focusBoholMap();
  }
});

initBoholMap();

// Blood type compatibility (who can receive from whom)
const receiveFrom = {
  'A+': ['A+', 'A-', 'O+', 'O-'],
  'A-': ['A-', 'O-'],
  'B+': ['B+', 'B-', 'O+', 'O-'],
  'B-': ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+': ['O+', 'O-'],
  'O-': ['O-']
};

const donateTo = {
  'A+': ['A+', 'AB+'],
  'A-': ['A+', 'A-', 'AB+', 'AB-'],
  'B+': ['B+', 'AB+'],
  'B-': ['B+', 'B-', 'AB+', 'AB-'],
  'AB+': ['AB+'],
  'AB-': ['AB+', 'AB-'],
  'O+': ['A+', 'B+', 'AB+', 'O+'],
  'O-': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
};

// ---- Auth & Profile ----
let currentProfile = null;
let pendingProfilePhoto = '';
let quickProfilePhotoMode = false;
let profileUpdateToastTimer = null;
let heroGreetingTimer = null;
let allRequests = [];
let activeRequestFilter = 'all';
let requestSubscription = null;
let currentAccountRoles = new Set();
let donorDashboardData = null;
let donorDashboardLoading = false;

function profilePhotoStorageKey(profile = currentProfile) {
  const owner = profile?.patient_id || profile?.donor_id || profile?.id || profile?.email || 'patient';
  return `veindropProfilePhoto:${owner}`;
}

function getTimeBasedGreeting(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

function updateDashboardGreeting(profile = currentProfile) {
  if (!profile) return;

  const now = new Date();
  const greeting = getTimeBasedGreeting(now);
  const firstName = String(profile.first_name || 'Patient').trim();
  const greetingName = String(profile.username || firstName).trim();
  const shortGreetingName = greetingName.length > 12 ? `${greetingName.slice(0, 12)}....` : greetingName;
  const heroTitle = document.getElementById('heroTitle');

  if (heroTitle) heroTitle.textContent = `${greeting}, ${shortGreetingName}`;
  const headerGreeting = document.getElementById('headerGreeting');
  if (headerGreeting) headerGreeting.remove();

  const nextPeriod = new Date(now);
  if (now.getHours() < 12) {
    nextPeriod.setHours(12, 0, 0, 0);
  } else if (now.getHours() < 18) {
    nextPeriod.setHours(18, 0, 0, 0);
  } else {
    nextPeriod.setDate(nextPeriod.getDate() + 1);
    nextPeriod.setHours(0, 0, 0, 0);
  }

  clearTimeout(heroGreetingTimer);
  heroGreetingTimer = setTimeout(() => updateDashboardGreeting(currentProfile), Math.max(1000, nextPeriod - now));
}

function getSavedProfilePhoto(profile) {
  try {
    return localStorage.getItem(profilePhotoStorageKey(profile)) || '';
  } catch (_) {
    return '';
  }
}

function saveProfilePhoto(profile, photoUrl) {
  try {
    const key = profilePhotoStorageKey(profile);
    if (photoUrl) localStorage.setItem(key, photoUrl);
    else localStorage.removeItem(key);
  } catch (_) {
    throw new Error('The photo could not be saved on this device. Please choose a smaller image.');
  }
}

function showProfileUpdateToast(message = 'Profile picture updated successfully.') {
  const toast = document.getElementById('profileUpdateToast');
  if (!toast) return;

  const text = toast.querySelector('span');
  if (text) text.textContent = message;
  clearTimeout(profileUpdateToastTimer);
  toast.hidden = false;
  requestAnimationFrame(() => toast.classList.add('visible'));

  profileUpdateToastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => {
      if (!toast.classList.contains('visible')) toast.hidden = true;
    }, 220);
  }, 3000);
}
let showMissedDrives = false;
let activeDonorSearchType = 'compatible';
let donorZoneMarkers = [];

// Blood Drives data (Empty by default — populated dynamically when drives exist)
const BLOOD_DRIVE_PLAN = [];

const DONOR_SEARCH_BLOOD_TYPES = ['Compatible', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const DONOR_SEARCH_ZONES = [
  { name: 'Tagbilaran care zone', area: 'Tagbilaran City', lat: 9.6500, lng: 123.8550 },
  { name: 'Panglao coastal zone', area: 'Panglao', lat: 9.5780, lng: 123.7460 },
  { name: 'Dauis response zone', area: 'Dauis', lat: 9.6225, lng: 123.8652 },
  { name: 'Tubigon north zone', area: 'Tubigon', lat: 9.9528, lng: 123.9624 },
  { name: 'Talibon emergency zone', area: 'Talibon', lat: 10.1497, lng: 124.3250 },
  { name: 'Ubay east zone', area: 'Ubay', lat: 10.0560, lng: 124.4720 }
];

const FALLBACK_DONOR_COUNTS = {
  'O+': [4, 2, 3, 1, 2, 2],
  'O-': [1, 0, 1, 0, 1, 0],
  'A+': [3, 2, 1, 2, 1, 1],
  'A-': [1, 1, 0, 1, 0, 1],
  'B+': [2, 1, 2, 1, 2, 1],
  'B-': [0, 1, 1, 0, 1, 0],
  'AB+': [1, 0, 1, 0, 0, 1],
  'AB-': [0, 1, 0, 0, 1, 0]
};

function formatDateShort(dateStr) {
  if (!dateStr) return '--';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getDriveStatusBadge(status) {
  const statusLower = String(status || '').toLowerCase();
  if (statusLower === 'missed') return '<span class="badge missed">Missed</span>';
  if (statusLower === 'completed') return '<span class="badge completed">Completed</span>';
  if (statusLower === 'full') return '<span class="badge approved">Full</span>';
  if (statusLower === 'recruiting') return '<span class="badge pending">Recruiting</span>';
  return '<span class="badge processing">' + (status || 'Unknown') + '</span>';
}

function getDriveStatusClass(status) {
  const statusLower = String(status || '').toLowerCase();
  if (statusLower === 'missed') return 'missed';
  if (statusLower === 'completed') return 'completed';
  if (statusLower === 'full') return 'full';
  if (statusLower === 'recruiting') return 'recruiting';
  return 'scheduled';
}

function isDrivePast(drive) {
  if (!drive?.date) return false;
  const driveDate = new Date(`${drive.date}T23:59:59`);
  if (Number.isNaN(driveDate.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return driveDate < today;
}

function getVisibleDriveStatus(drive) {
  return isDrivePast(drive) ? 'missed' : drive.status;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function formatNumber(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue.toLocaleString('en-US') : '--';
}

function formatPatientDisplayName(profile) {
  const firstName = String(profile?.first_name || '').trim();
  const middleName = String(profile?.middle_name || '').trim();
  const lastName = String(profile?.last_name || '').trim();
  const middleInitial = middleName ? `${middleName.charAt(0).toUpperCase()}.` : '';
  return [firstName, middleInitial, lastName].filter(Boolean).join(' ') || 'Patient';
}

function getCurrentSearchTypes() {
  if (activeDonorSearchType !== 'compatible') return [activeDonorSearchType];
  const patientType = currentProfile?.blood_type || currentProfile?.blood_type_needed || '';
  return receiveFrom[patientType] || DONOR_SEARCH_BLOOD_TYPES.filter((type) => type !== 'Compatible');
}

function getDonorSearchLabel() {
  if (activeDonorSearchType !== 'compatible') return activeDonorSearchType;
  const patientType = currentProfile?.blood_type || currentProfile?.blood_type_needed || '';
  return patientType ? `Compatible for ${patientType}` : 'Compatible donors';
}

function renderDonorTypeFilters() {
  const filters = document.getElementById('donorTypeFilters');
  if (!filters) return;

  filters.innerHTML = DONOR_SEARCH_BLOOD_TYPES.map((type) => {
    const value = type.toLowerCase();
    const active = activeDonorSearchType === value || activeDonorSearchType === type;
    return `<button type="button" class="${active ? 'active' : ''}" data-donor-type="${value === 'compatible' ? 'compatible' : type}">${type}</button>`;
  }).join('');

  filters.querySelectorAll('[data-donor-type]').forEach((button) => {
    button.addEventListener('click', () => {
      activeDonorSearchType = button.dataset.donorType;
      renderDonorTypeFilters();
      searchDonorZones();
    });
  });
}

function hashDonorToZone(donor) {
  const area = String(donor?.map_area || donor?.area || donor?.city || '').trim().toLowerCase();
  const areaIndex = DONOR_SEARCH_ZONES.findIndex((zone) => zone.area.toLowerCase() === area);
  if (areaIndex >= 0) return areaIndex;
  const source = String(donor?.id || donor?.donor_id || donor?.email || donor?.name || donor?.first_name || 'donor');
  return source.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % DONOR_SEARCH_ZONES.length;
}

function buildDonorZonesFromList(donors) {
  const targetTypes = getCurrentSearchTypes();
  if (!targetTypes.length) return [];

  const zoneCounts = DONOR_SEARCH_ZONES.map((zone) => ({ ...zone, count: 0 }));
  (donors || []).forEach((donor) => {
    const bloodType = String(donor?.blood_type || '').trim().toUpperCase();
    const availability = String(donor?.availability_status || '').toLowerCase();
    const status = String(donor?.donor_status || '').toLowerCase();
    const showOnMap = donor?.show_on_map === true;
    const locationStatus = String(donor?.location_status || 'needs_review').toLowerCase();
    const isAvailable = availability === 'available' || status === 'approved' || status === 'registered';
    if (!targetTypes.includes(bloodType) || !isAvailable || !showOnMap || locationStatus !== 'verified') return;
    zoneCounts[hashDonorToZone(donor)].count += 1;
  });

  return zoneCounts.filter((zone) => zone.count > 0);
}

function buildFallbackDonorZones() {
  const targetTypes = getCurrentSearchTypes();
  const zoneCounts = DONOR_SEARCH_ZONES.map((zone, index) => {
    const count = targetTypes.reduce((sum, type) => sum + Number(FALLBACK_DONOR_COUNTS[type]?.[index] || 0), 0);
    return { ...zone, count };
  });
  return zoneCounts.filter((zone) => zone.count > 0);
}

function clearDonorZoneMarkers() {
  if (!boholMap || !donorZoneMarkers.length) {
    donorZoneMarkers = [];
    return;
  }
  donorZoneMarkers.forEach((marker) => {
    try { marker.remove(); } catch (_) { }
  });
  donorZoneMarkers = [];
}

function renderDonorZoneResults(zones, usedFallback = false) {
  const title = document.getElementById('donorSearchTitle');
  const results = document.getElementById('donorSearchResults');
  if (title) title.textContent = getDonorSearchLabel();
  if (!results) return;

  clearDonorZoneMarkers();

  if (!zones.length) {
    results.innerHTML = '<p>No active donor zones found for this blood type. Submit a request so admins can coordinate support.</p>';
    return;
  }

  results.innerHTML = zones.map((zone) => `
        <button type="button" class="donor-zone-result" data-zone="${escapeHtml(zone.name)}">
          <span><i class="fa-solid fa-location-crosshairs"></i> ${escapeHtml(zone.area)}</span>
          <strong>${formatNumber(zone.count)} donor${zone.count === 1 ? '' : 's'}</strong>
        </button>
      `).join('') + (usedFallback ? '<small>Showing privacy-safe sample zones until live donor access is available.</small>' : '<small>Exact donor locations are hidden for privacy.</small>');

  if (boholMap && typeof L !== 'undefined') {
    const bounds = [];
    zones.forEach((zone) => {
      const marker = L.marker([zone.lat, zone.lng], {
        icon: L.divIcon({
          className: 'donor-zone-marker-wrapper',
          html: `<div class="donor-zone-marker"><i class="fa-solid fa-user-group"></i><span>${zone.count}</span></div>`,
          iconSize: [42, 42],
          iconAnchor: [21, 42]
        })
      }).addTo(boholMap);
      marker.bindPopup(`<strong>${escapeHtml(zone.area)}</strong><br/>${formatNumber(zone.count)} compatible donor${zone.count === 1 ? '' : 's'} nearby`);
      donorZoneMarkers.push(marker);
      bounds.push([zone.lat, zone.lng]);
    });

    if (bounds.length) {
      boholMap.fitBounds(bounds, { padding: [54, 54], maxZoom: 12 });
    }
  }

  results.querySelectorAll('[data-zone]').forEach((button, index) => {
    button.addEventListener('click', () => {
      const zone = zones[index];
      if (boholMap && zone) boholMap.setView([zone.lat, zone.lng], 12);
    });
  });
}

async function searchDonorZones() {
  const results = document.getElementById('donorSearchResults');
  if (results) results.innerHTML = '<p>Searching donor zones...</p>';

  if (typeof listVisibleDonors === 'function') {
    try {
      const { data, error } = await listVisibleDonors();
      if (!error && Array.isArray(data)) {
        const zones = buildDonorZonesFromList(data);
        renderDonorZoneResults(zones, false);
        return;
      }
    } catch (_) { }
  }

  renderDonorZoneResults(buildFallbackDonorZones(), true);
}

function openMobileDonorSearch() {
  window.location.href = 'patient_donor_map.html';
}

function renderBloodDrives() {
  const tableBody = document.getElementById('drivesTableBody');
  if (!tableBody) return;

  const drives = BLOOD_DRIVE_PLAN.slice();
  const missedDrives = drives.filter(isDrivePast);
  const activeDrives = drives.filter((drive) => !isDrivePast(drive));
  const visibleDrives = showMissedDrives ? missedDrives : activeDrives;
  const missedToggle = document.getElementById('missedDrivesToggle');
  const missedCount = document.getElementById('missedDrivesCount');

  if (missedToggle) {
    missedToggle.classList.toggle('active', showMissedDrives);
    missedToggle.setAttribute('aria-pressed', showMissedDrives ? 'true' : 'false');
  }
  if (missedCount) missedCount.textContent = formatNumber(missedDrives.length);

  if (!drives.length) {
    tableBody.innerHTML = '<p class="drive-empty">No blood drives scheduled.</p>';
    return;
  }

  if (!visibleDrives.length) {
    tableBody.innerHTML = showMissedDrives
      ? '<p class="drive-empty">No missed blood drive opportunities.</p>'
      : '<p class="drive-empty">No upcoming blood drives right now. Use <strong>Past Blood Drives</strong> to review previous campaigns.</p>';
    return;
  }

  tableBody.innerHTML = visibleDrives.map((drive) => {
    const target = Number(drive.target_units) || 0;
    const registered = Number(drive.registered_donors) || 0;
    const percent = target > 0 ? Math.min(100, Math.round((registered / target) * 100)) : 0;
    const open = Math.max(0, target - registered);
    const visibleStatus = getVisibleDriveStatus(drive);
    const statusClass = getDriveStatusClass(visibleStatus);
    const driveId = escapeHtml(drive.drive_id || '');
    return `<article class="drive-card ${statusClass}" role="button" tabindex="0" data-drive-id="${driveId}" onclick="openDriveDetailsModal('${driveId}')" onkeydown="handleDriveCardKeydown(event, '${driveId}')" aria-label="View details for ${escapeHtml(drive.drive_name || 'blood drive')}">
          <div class="drive-card-top">
            <div class="drive-date">
              <strong>${formatDateShort(drive.date).split(',')[0]}</strong>
              <span>${formatDateShort(drive.date).split(',')[1] || ''}</span>
            </div>
            ${getDriveStatusBadge(visibleStatus)}
          </div>
          <div class="drive-main">
            <h3>${escapeHtml(drive.drive_name || '--')}</h3>
            <p><i class="fa-solid fa-location-dot"></i> ${escapeHtml(drive.venue || '--')}</p>
          </div>
          <div class="drive-meta">
            <span><i class="fa-solid fa-fingerprint"></i> ${driveId || '--'}</span>
            <span class="type-pill">${escapeHtml(drive.focus_type || '--')}</span>
          </div>
          <div class="drive-progress" aria-label="${percent}% donor registration progress">
            <div class="drive-progress-head">
              <span>${formatNumber(registered)} registered</span>
              <strong>${formatNumber(open)} open</strong>
            </div>
            <div class="drive-progress-track"><span style="width:${percent}%"></span></div>
            <div class="drive-progress-foot">
              <span>${percent}% filled</span>
              <span>${formatNumber(target)} target units</span>
            </div>
          </div>
        </article>`;
  }).join('');
}

function toggleMissedDrives() {
  showMissedDrives = !showMissedDrives;
  renderBloodDrives();
}

function getBloodDriveById(driveId) {
  const normalizedId = String(driveId || '');
  return BLOOD_DRIVE_PLAN.find((drive) => String(drive.drive_id || '') === normalizedId) || null;
}

function handleDriveCardKeydown(event, driveId) {
  if (event.key !== 'Enter' && event.key !== ' ') return;
  event.preventDefault();
  openDriveDetailsModal(driveId);
}

function openDriveDetailsModal(driveId) {
  const drive = getBloodDriveById(driveId);
  const modal = document.getElementById('driveDetailsModal');
  const title = document.getElementById('driveDetailsTitle');
  const content = document.getElementById('driveDetailsContent');
  if (!drive || !modal || !content) return;

  const target = Number(drive.target_units) || 0;
  const registered = Number(drive.registered_donors) || 0;
  const open = Math.max(0, target - registered);
  const percent = target > 0 ? Math.min(100, Math.round((registered / target) * 100)) : 0;

  if (title) {
    title.innerHTML = '<i class="fa-solid fa-vial"></i> ' + escapeHtml(drive.drive_name || 'Blood drive details');
  }

  content.innerHTML = `
        <div class="drive-detail-hero">
          <div>
            <span class="type-pill">${escapeHtml(drive.focus_type || '--')}</span>
            <h4>${escapeHtml(drive.drive_name || '--')}</h4>
            <p>${escapeHtml(drive.drive_id || '--')}</p>
          </div>
          ${getDriveStatusBadge(drive.status)}
        </div>
        <div class="drive-detail-grid">
          <div class="drive-detail-item">
            <span><i class="fa-solid fa-calendar-days"></i> Date</span>
            <strong>${formatDateShort(drive.date)}</strong>
          </div>
          <div class="drive-detail-item">
            <span><i class="fa-solid fa-location-dot"></i> Venue</span>
            <strong>${escapeHtml(drive.venue || '--')}</strong>
          </div>
          <div class="drive-detail-item">
            <span><i class="fa-solid fa-droplet"></i> Target units</span>
            <strong>${formatNumber(target)}</strong>
          </div>
          <div class="drive-detail-item">
            <span><i class="fa-solid fa-user-group"></i> Registered donors</span>
            <strong>${formatNumber(registered)}</strong>
          </div>
          <div class="drive-detail-item">
            <span><i class="fa-solid fa-door-open"></i> Open slots</span>
            <strong>${formatNumber(open)}</strong>
          </div>
          <div class="drive-detail-item">
            <span><i class="fa-solid fa-chart-simple"></i> Progress</span>
            <strong>${percent}% filled</strong>
          </div>
        </div>
        <div class="drive-progress detail">
          <div class="drive-progress-head">
            <span>${formatNumber(registered)} registered</span>
            <strong>${formatNumber(open)} open</strong>
          </div>
          <div class="drive-progress-track"><span style="width:${percent}%"></span></div>
        </div>
      `;

  modal.classList.add('active');
  document.body.classList.add('modal-open');
}

function closeDriveDetailsModal() {
  const modal = document.getElementById('driveDetailsModal');
  if (modal) modal.classList.remove('active');
  document.body.classList.remove('modal-open');
}

async function refreshDashboardData(options = {}) {
  try {
    if (typeof getCurrentUserProfile === 'function') {
      const { profile } = await getCurrentUserProfile();
      if (profile) {
        currentProfile = profile;
        applyProfileToUI(profile);
      }
    }
    if (currentProfile?.has_patient_profile) {
      loadRequests();
    }
    if (currentProfile?.has_donor_profile) {
      loadDonorDashboard();
    }
    renderBloodDrives();
    if (typeof updateUnreadBadge === 'function') {
      updateUnreadBadge();
    }
  } catch (err) {
    console.warn('Dashboard background refresh warning:', err);
  }
}

function initRequestsRealtime() {
  // Unsubscribe existing
  if (requestSubscription && typeof requestSubscription.unsubscribe === 'function') {
    try { requestSubscription.unsubscribe(); } catch (_) { }
  }
  const patientId = currentProfile?.patient_id || currentProfile?.id || null;
  const userId = currentProfile?.user_id || currentProfile?.id || null;

  if (typeof subscribeToPatientDashboard === 'function') {
    requestSubscription = subscribeToPatientDashboard({ patientId, userId }, (change) => {
      if (change.type === 'blood_request' || change.type === 'donor_pledge') {
        if (currentProfile?.has_patient_profile) loadRequests();
        if (currentProfile?.has_donor_profile) loadDonorDashboard();
      } else if (change.type === 'blood_drive') {
        renderBloodDrives();
      } else if (change.type === 'blood_inventory') {
        if (currentProfile?.has_patient_profile) loadRequests();
      } else if (change.type === 'notifications') {
        if (typeof updateUnreadBadge === 'function') updateUnreadBadge();
      }
    });
  } else if (typeof subscribeToRequestChanges === 'function' && patientId) {
    requestSubscription = subscribeToRequestChanges(patientId, () => {
      loadRequests();
    });
  }
}

function hasAccountRole(role) {
  return currentAccountRoles.has(String(role || '').toLowerCase());
}

function showAccountRoleMessage(message = '', type = 'info') {
  const element = document.getElementById('accountRoleMessage');
  if (!element) return;
  element.hidden = !message;
  element.textContent = message;
  element.className = `form-msg account-role-message${message ? ` ${type}` : ''}`;
}

function preferredViewStorageKey() {
  return `veindropDashboardView:${String(currentProfile?.email || 'account').toLowerCase()}`;
}

function savePreferredDashboardView(view) {
  try { localStorage.setItem(preferredViewStorageKey(), view); } catch (_) { }
}

function getPreferredDashboardView() {
  try { return localStorage.getItem(preferredViewStorageKey()) || ''; } catch (_) { return ''; }
}

function renderAccountRoleControls(profile) {
  const roles = Array.isArray(profile?.roles) ? profile.roles : [];
  currentAccountRoles = new Set(roles.map((role) => String(role).toLowerCase()));
  if (profile?.has_patient_profile) currentAccountRoles.add('patient');
  if (profile?.has_donor_profile) currentAccountRoles.add('donor');

  const hasPatient = currentAccountRoles.has('patient') && Boolean(profile?.has_patient_profile);
  const hasDonor = currentAccountRoles.has('donor') && Boolean(profile?.has_donor_profile);
  const roleSummary = document.getElementById('accountRoleSummary');
  const headerRoleDisplay = document.getElementById('headerRoleDisplay');
  const portalRoleLabel = document.getElementById('portalRoleLabel');
  const donorViewText = document.getElementById('donorViewBtnText');
  const donorSetupMessage = document.getElementById('donorSetupMessage');
  const donorEnrollment = document.getElementById('donorEnrollmentState');
  const donorDashboard = document.getElementById('donorDashboardState');

  let label = 'Patient';
  let icon = 'fa-hand-holding-medical';
  if (hasPatient && hasDonor) {
    label = 'Patient & Donor';
    icon = 'fa-user-group';
  } else if (hasDonor) {
    label = 'Donor';
    icon = 'fa-heart-pulse';
  }

  if (roleSummary) {
    roleSummary.classList.toggle('dual-role', hasPatient && hasDonor);
    roleSummary.innerHTML = `<i class="fa-solid ${icon}"></i> ${label}`;
  }
  if (headerRoleDisplay) headerRoleDisplay.textContent = label;
  if (portalRoleLabel) portalRoleLabel.textContent = `${label} Portal`;
  if (donorViewText) donorViewText.textContent = hasDonor ? 'Donor View' : 'Become a Donor';

  if (donorEnrollment) donorEnrollment.hidden = hasDonor;
  if (donorDashboard) donorDashboard.hidden = !hasDonor;
  if (donorSetupMessage) {
    const setupError = !hasDonor ? String(profile?.donor_setup_error || '') : '';
    donorSetupMessage.hidden = !setupError;
    donorSetupMessage.textContent = setupError;
  }
}

async function openPatientView(destination = 'dashboard') {
  savePreferredDashboardView('patient');
  if (currentProfile?.has_patient_profile) {
    navigateToSection(destination);
    return;
  }

  showAccountRoleMessage('Activating patient features on this account...', 'info');

  try {
    const { error } = await activateMyPatientProfile({
      first_name: currentProfile?.first_name,
      middle_name: currentProfile?.middle_name,
      last_name: currentProfile?.last_name,
      blood_type: currentProfile?.blood_type || currentProfile?.blood_type_needed,
      phone: currentProfile?.phone || currentProfile?.contact_number,
      address: currentProfile?.address
    });
    if (error) {
      showAccountRoleMessage(error.message || 'Unable to activate patient features.', 'error');
      return;
    }

    const account = await getCurrentUser();
    if (!account?.profile) throw new Error('The updated account could not be loaded.');
    applyProfileToUI(account.profile);
    await loadRequests();
    initRequestsRealtime();
    showAccountRoleMessage('Patient features are now active on your existing account.', 'success');
    navigateToSection(destination);
  } catch (error) {
    showAccountRoleMessage(error?.message || 'Unable to activate patient features.', 'error');
  }
}

function openDonorView() {
  if (currentProfile?.has_donor_profile) {
    savePreferredDashboardView('donor');
    navigateToSection('donor');
    return;
  }
  window.location.href = 'donor_registration.html?return=patient_dashboard.html%23section-donor';
}

function formatDonorStatus(value) {
  if (typeof getDonorLifecycleLabel === 'function') return getDonorLifecycleLabel(value);
  return String(value || 'registered')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getDonationStatusBadge(status) {
  const normalized = String(status || 'completed').toLowerCase();
  switch (normalized) {
    case 'completed':
      return '<span class="badge completed"><i class="fa-solid fa-circle-check"></i> Completed</span>';
    case 'pending':
      return '<span class="badge pending"><i class="fa-solid fa-clock"></i> Pending</span>';
    case 'failed':
      return '<span class="badge failed"><i class="fa-solid fa-circle-xmark"></i> Failed</span>';
    case 'cancelled':
      return '<span class="badge cancelled"><i class="fa-solid fa-ban"></i> Cancelled</span>';
    default:
      return `<span class="badge pending"><i class="fa-solid fa-circle-notch"></i> ${escapeHtml(normalized.charAt(0).toUpperCase() + normalized.slice(1))}</span>`;
  }
}

function renderDonorDashboard(data) {
  const donor = data?.donor;
  if (!donor) return;

  donorDashboardData = data;
  const status = String(donor.donor_status || 'registered').toLowerCase();
  const availability = String(donor.availability_status || 'unavailable').toLowerCase();
  const history = Array.isArray(data.donations) ? data.donations : [];

  // 1. Calculate Real Statistics from database records
  const totalCount = history.length;
  const completedList = history.filter((d) => String(d.status || 'completed').toLowerCase() === 'completed');
  const completedCount = completedList.length;
  const pendingCount = history.filter((d) => String(d.status || '').toLowerCase() === 'pending').length;
  const failedCount = history.filter((d) => String(d.status || '').toLowerCase() === 'failed').length;
  const cancelledCount = history.filter((d) => String(d.status || '').toLowerCase() === 'cancelled').length;

  // 2. Determine last donation date from completed records or donor profile
  let latestDonationDateStr = donor.last_donation_date || null;
  if (completedList.length > 0 && completedList[0].donation_date) {
    latestDonationDateStr = completedList[0].donation_date;
  }
  const lastDonation = latestDonationDateStr ? new Date(`${latestDonationDateStr}T00:00:00`) : null;
  const nextEligible = lastDonation ? new Date(lastDonation.getTime() + 56 * 24 * 60 * 60 * 1000) : null;

  // 3. Evaluate eligibility
  const eligibility = typeof isEligibleToCheckIn === 'function'
    ? isEligibleToCheckIn({ ...donor, last_donation_date: latestDonationDateStr })
    : { eligible: !latestDonationDateStr, daysRemaining: 0 };
  const medicallyDeferred = status === 'deferred';
  const eligible = eligibility.eligible && !medicallyDeferred;

  // 4. Update Summary Stat Cards
  const elStat = document.getElementById('donorEligibilityStat');
  const elSub = document.getElementById('donorEligibilitySub');
  if (elStat) elStat.textContent = medicallyDeferred ? 'Deferred' : (eligible ? 'Eligible' : 'Waiting');
  if (elSub) {
    elSub.textContent = medicallyDeferred
      ? (donor.deferred_reason || 'Staff clearance required')
      : (eligible ? 'Eligible for donor check-in' : `${eligibility.daysRemaining || 0} day(s) remaining`);
  }

  const avStat = document.getElementById('donorAvailabilityStat');
  const avSub = document.getElementById('donorAvailabilitySub');
  if (avStat) avStat.textContent = availability === 'available' ? 'Available' : 'Paused';
  if (avSub) avSub.textContent = availability === 'available' ? 'Ready to respond' : 'Currently paused';

  const lastStat = document.getElementById('donorLastDonationStat');
  const lastSub = document.getElementById('donorLastDonationSub');
  if (lastStat) {
    lastStat.textContent = lastDonation
      ? lastDonation.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'No history';
  }
  if (lastSub) {
    lastSub.textContent = completedCount > 0
      ? `${completedCount} completed donation${completedCount === 1 ? '' : 's'}`
      : 'No completed records';
  }

  const nextStat = document.getElementById('donorNextEligibleStat');
  if (nextStat) {
    nextStat.textContent = nextEligible
      ? nextEligible.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'Now';
  }

  // 5. Update Activity Breakdown Summary Pills
  const statTotal = document.getElementById('statTotalDonations');
  const statCompleted = document.getElementById('statCompletedDonations');
  const statPending = document.getElementById('statPendingDonations');
  const statFailed = document.getElementById('statFailedDonations');
  const statCancelled = document.getElementById('statCancelledDonations');
  const countBadge = document.getElementById('donorHistoryCountBadge');

  if (statTotal) statTotal.textContent = String(totalCount);
  if (statCompleted) statCompleted.textContent = String(completedCount);
  if (statPending) statPending.textContent = String(pendingCount);
  if (statFailed) statFailed.textContent = String(failedCount);
  if (statCancelled) statCancelled.textContent = String(cancelledCount);
  if (countBadge) countBadge.textContent = `${totalCount} recorded`;

  // 6. Profile Info
  const bt = document.getElementById('donorBloodType');
  const pname = document.getElementById('donorProfileName');
  const pid = document.getElementById('donorProfileId');
  if (bt) bt.textContent = donor.blood_type || '--';
  if (pname) pname.textContent = formatPatientDisplayName(donor);
  if (pid) pid.textContent = `Donor ID ${donor.donor_id || '--'}`;

  const lifecycleBadge = document.getElementById('donorLifecycleBadge');
  if (lifecycleBadge) {
    lifecycleBadge.textContent = formatDonorStatus(status);
    lifecycleBadge.className = `badge ${typeof getDonorLifecycleBadgeClass === 'function' ? getDonorLifecycleBadgeClass(status) : status}`;
  }

  const availabilityToggle = document.getElementById('donorAvailabilityToggle');
  if (availabilityToggle) {
    const isAvailable = availability === 'available';
    availabilityToggle.setAttribute('aria-pressed', isAvailable ? 'true' : 'false');
    const label = availabilityToggle.querySelector('strong');
    if (label) label.textContent = isAvailable ? 'On' : 'Off';
    availabilityToggle.disabled = medicallyDeferred || (!eligible && !isAvailable);
  }

  const mapVisibilityToggle = document.getElementById('donorMapVisibilityToggle');
  if (mapVisibilityToggle) {
    const isMapVisible = donor.show_on_map === true;
    mapVisibilityToggle.setAttribute('aria-pressed', isMapVisible ? 'true' : 'false');
    const mapLabel = mapVisibilityToggle.querySelector('strong');
    if (mapLabel) mapLabel.textContent = isMapVisible ? 'On' : 'Off';
  }

  const avHelp = document.getElementById('donorAvailabilityHelp');
  if (avHelp) {
    avHelp.textContent = medicallyDeferred
      ? 'Availability is locked until staff clears the deferral.'
      : (!eligible && !availability === 'available'
        ? 'Availability unlocks after the 56-day waiting period.'
        : 'Pause this when you cannot donate.');
  }

  // 7. Render Rich Donation History List
  const historyElement = document.getElementById('donorDonationHistory');
  if (historyElement) {
    if (history.length === 0) {
      historyElement.innerHTML = `
        <div class="donor-empty-state">
          <i class="fa-solid fa-hand-holding-heart"></i>
          <p>No donation records found yet.</p>
          <small>Your donation history and status tracking will appear here after your first donation at a community drive or blood bank.</small>
        </div>`;
    } else {
      historyElement.innerHTML = history.map((item) => {
        const itemBloodType = item.blood_type || donor.blood_type || '--';
        const itemUnits = Number(item.quantity) || 1;
        const itemStatus = String(item.status || 'completed').toLowerCase();
        const hasNotes = Boolean(item.notes && String(item.notes).trim() !== '');

        return `
          <article class="donor-activity-item status-${escapeHtml(itemStatus)}">
            <div class="donor-activity-icon ${escapeHtml(itemStatus)}">
              <i class="fa-solid fa-droplet" aria-hidden="true"></i>
            </div>
            <div class="donor-activity-main">
              <div class="donor-activity-headline">
                <strong>${escapeHtml(itemBloodType)} Donation (${formatNumber(itemUnits)} unit${itemUnits === 1 ? '' : 's'})</strong>
                ${getDonationStatusBadge(itemStatus)}
              </div>
              <div class="donor-activity-sub">
                <time datetime="${escapeHtml(item.donation_date || '')}">
                  <i class="fa-regular fa-calendar" aria-hidden="true"></i> ${formatDateShort(item.donation_date)}
                </time>
              </div>
              ${hasNotes ? `
                <div class="donation-reason-note">
                  <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
                  <span>${escapeHtml(item.notes)}</span>
                </div>
              ` : ''}
            </div>
          </article>`;
      }).join('');
    }
  }

  // 8. Render Matching Requests
  const matches = Array.isArray(data.matching_requests) ? data.matching_requests : [];
  const matchCount = document.getElementById('donorMatchCount');
  if (matchCount) matchCount.textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;

  const matchElement = document.getElementById('donorMatchingRequests');
  if (matchElement) {
    matchElement.innerHTML = matches.length ? matches.map((request) => {
      const urgency = String(request.urgency_level || 'normal').toLowerCase();
      return `<article class="request-card">
            <div class="request-type">${escapeHtml(request.blood_type_needed || '--')}</div>
            <div class="request-info">
              <strong>Approved compatible request</strong>
              <span>${formatNumber(request.quantity || 0)} unit(s) requested</span>
            </div>
            <div class="request-meta">
              <span class="badge ${escapeHtml(urgency)}">${escapeHtml(urgency.charAt(0).toUpperCase() + urgency.slice(1))}</span>
              <small>${formatDateShort(request.request_date)}</small>
            </div>
          </article>`;
    }).join('') : '<p class="donor-empty-state">There are no approved requests compatible with your blood type right now.</p>';
  }
}

async function loadDonorDashboard(force = false) {
  const enrollment = document.getElementById('donorEnrollmentState');
  const dashboard = document.getElementById('donorDashboardState');
  if (!currentProfile?.has_donor_profile) {
    if (enrollment) enrollment.hidden = false;
    if (dashboard) dashboard.hidden = true;
    return;
  }

  if (enrollment) enrollment.hidden = true;
  if (dashboard) dashboard.hidden = false;
  if (donorDashboardLoading) return;
  if (donorDashboardData && !force) {
    renderDonorDashboard(donorDashboardData);
    return;
  }

  donorDashboardLoading = true;
  const historyElement = document.getElementById('donorDonationHistory');
  if (historyElement && (!donorDashboardData || force)) {
    historyElement.innerHTML = `
      <div class="donor-empty-state loading">
        <i class="fa-solid fa-spinner fa-spin"></i>
        <p>Loading donation records...</p>
      </div>`;
  }

  const message = document.getElementById('donorDashboardMessage');
  if (message) {
    message.textContent = 'Loading your donor information...';
    message.className = 'form-msg info';
  }

  try {
    const { data, error } = await getMyDonorDashboardData();
    if (error) throw error;
    renderDonorDashboard(data);
    if (message) {
      message.textContent = '';
      message.className = 'form-msg';
    }
  } catch (error) {
    if (message) {
      message.textContent = error?.message || 'Unable to load donor information. Please try again.';
      message.className = 'form-msg error';
    }
    if (historyElement) {
      historyElement.innerHTML = `
        <div class="donor-empty-state error">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <p>Failed to load donation history.</p>
          <button type="button" class="btn-sm btn-secondary" onclick="loadDonorDashboard(true)" style="margin-top:8px;cursor:pointer;">
            <i class="fa-solid fa-rotate-right"></i> Retry
          </button>
        </div>`;
    }
  } finally {
    donorDashboardLoading = false;
  }
}

async function toggleMyDonorAvailability() {
  const button = document.getElementById('donorAvailabilityToggle');
  const message = document.getElementById('donorDashboardMessage');
  const nextAvailable = button.getAttribute('aria-pressed') !== 'true';
  button.disabled = true;
  if (message) {
    message.textContent = 'Updating availability...';
    message.className = 'form-msg info';
  }

  try {
    const { data, error } = await setMyDonorAvailability(nextAvailable);
    if (error) throw error;
    donorDashboardData = { ...(donorDashboardData || {}), donor: data };
    renderDonorDashboard(donorDashboardData);
    if (currentProfile) currentProfile.donor_profile = data;
    if (message) {
      message.textContent = nextAvailable
        ? 'You are now available for compatible donor matching.'
        : 'Your donor availability is paused.';
      message.className = 'form-msg success';
    }
  } catch (error) {
    if (message) {
      message.textContent = error?.message || 'Unable to update availability.';
      message.className = 'form-msg error';
    }
  } finally {
    button.disabled = false;
  }
}

async function toggleMyDonorMapVisibility() {
  const button = document.getElementById('donorMapVisibilityToggle');
  const message = document.getElementById('donorDashboardMessage');
  const nextVisible = button.getAttribute('aria-pressed') !== 'true';
  button.disabled = true;
  if (message) {
    message.textContent = 'Updating map privacy settings...';
    message.className = 'form-msg info';
  }

  try {
    const { data, error } = await setMyDonorMapVisibility(nextVisible);
    if (error) throw error;
    if (donorDashboardData?.donor) {
      donorDashboardData.donor = { ...donorDashboardData.donor, show_on_map: nextVisible };
    }
    renderDonorDashboard(donorDashboardData);
    if (currentProfile?.donor_profile) currentProfile.donor_profile.show_on_map = nextVisible;
    if (message) {
      message.textContent = nextVisible
        ? 'Your approximate municipality will now appear on the Find Blood map when available.'
        : 'Your profile is now hidden from the Find Blood map.';
      message.className = 'form-msg success';
    }
  } catch (error) {
    if (message) {
      message.textContent = error?.message || 'Unable to update map privacy setting.';
      message.className = 'form-msg error';
    }
  } finally {
    button.disabled = false;
  }
}
window.toggleMyDonorMapVisibility = toggleMyDonorMapVisibility;
window.toggleMyDonorAvailability = toggleMyDonorAvailability;

function applyProfileToUI(profile) {
  if (!profile) return;

  currentProfile = profile;
  renderAccountRoleControls(profile);
  const patientBloodType = (
    profile.blood_type ||
    profile.blood_type_needed ||
    profile.donor_profile?.blood_type ||
    profile.patient_profile?.blood_type_needed ||
    profile.patient_profile?.blood_type ||
    ''
  ).trim().toUpperCase().replace(/\s+/g, '');
  const patientPhone = profile.phone || profile.contact_number || '';
  const patientAddress = profile.address || '';
  const patientGender = profile.gender || '';
  const fullName = formatPatientDisplayName(profile);

  // Header
  const headerNameDisplay = document.getElementById('headerNameDisplay');
  if (headerNameDisplay) headerNameDisplay.textContent = fullName;

  const dropdownFullName = document.getElementById('dropdownFullName');
  if (dropdownFullName) dropdownFullName.textContent = fullName;

  const dropdownEmail = document.getElementById('dropdownEmail');
  if (dropdownEmail) dropdownEmail.textContent = profile.email;

  updateDashboardGreeting(profile);

  // Initials
  const initials = (profile.first_name?.[0] || '') + (profile.last_name?.[0] || '');
  const headerInitials = document.getElementById('headerInitials');
  if (headerInitials) headerInitials.textContent = initials.toUpperCase();
  const sidebarInitials = document.getElementById('sidebarInitials');
  if (sidebarInitials) sidebarInitials.textContent = initials.toUpperCase();
  const requestsQuickInitial = document.getElementById('requestsQuickInitial');
  if (requestsQuickInitial) requestsQuickInitial.textContent = (initials || 'U').toUpperCase();

  const avatarUrl = String(profile.avatar_url || getSavedProfilePhoto(profile)).trim();
  currentProfile.avatar_url = avatarUrl;
  if (headerInitials) {
    headerInitials.classList.toggle('has-photo', Boolean(avatarUrl));
    headerInitials.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : '';
    if (!avatarUrl) headerInitials.textContent = initials.toUpperCase();
  }
  if (requestsQuickInitial) {
    const quickAvatarBox = document.getElementById('requestsQuickAvatar');
    if (quickAvatarBox) {
      if (avatarUrl) {
        quickAvatarBox.style.backgroundImage = `url("${avatarUrl}")`;
        quickAvatarBox.style.backgroundSize = 'cover';
        quickAvatarBox.style.backgroundPosition = 'center';
        requestsQuickInitial.textContent = '';
      } else {
        quickAvatarBox.style.backgroundImage = '';
        requestsQuickInitial.textContent = (initials || 'U').toUpperCase();
      }
    }
  }
  const profileAvatar = document.getElementById('profileInitials');
  if (profileAvatar) {
    profileAvatar.classList.toggle('has-photo', Boolean(avatarUrl));
    profileAvatar.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : '';
    const avatarContent = profileAvatar.querySelector('.profile-avatar-content');
    if (avatarContent) avatarContent.textContent = initials.toUpperCase();
  }

  // Sidebar
  const sidebarName = document.getElementById('sidebarName');
  if (sidebarName) sidebarName.textContent = fullName;
  const sidebarEmail = document.getElementById('sidebarEmail');
  if (sidebarEmail) sidebarEmail.textContent = profile.email;

  // Profile card
  const profileNameEl = document.getElementById('profileName');
  if (profileNameEl) profileNameEl.textContent = fullName;
  const profileEmailEl = document.getElementById('profileEmail');
  if (profileEmailEl) profileEmailEl.textContent = profile.email;
  const profileBloodTypeEl = document.getElementById('profileBloodType');
  if (profileBloodTypeEl) profileBloodTypeEl.textContent = patientBloodType || '-';
  const profilePhoneEl = document.getElementById('profilePhone');
  if (profilePhoneEl) profilePhoneEl.textContent = patientPhone || '-';
  const profileGenderEl = document.getElementById('profileGender');
  if (profileGenderEl) {
    profileGenderEl.textContent = patientGender
      ? patientGender.charAt(0).toUpperCase() + patientGender.slice(1) : '-';
  }
  const profileAddressEl = document.getElementById('profileAddress');
  if (profileAddressEl) profileAddressEl.textContent = patientAddress || '-';
  const profileSinceEl = document.getElementById('profileSince');
  if (profileSinceEl) {
    profileSinceEl.textContent = profile.created_at
      ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '-';
  }

  // Blood type stat
  const statBloodType = document.getElementById('statBloodType');
  if (statBloodType) statBloodType.textContent = patientBloodType || '-';
  const statBloodType2 = document.getElementById('statBloodType2');
  if (statBloodType2) statBloodType2.textContent = patientBloodType || '-';


  // Blood compatibility - dashboard quick actions
  const section = document.getElementById('compatSection');
  const tags = document.getElementById('compatTags');
  if (section && tags) {
    if (patientBloodType && receiveFrom[patientBloodType]) {
      section.style.display = '';
      tags.innerHTML = receiveFrom[patientBloodType]
        .map(t => '<span class="compat-tag receive">' + t + '</span>')
        .join('');
    } else {
      section.style.display = 'none';
      tags.innerHTML = '';
    }
  }

  // Blood compatibility - profile section
  const profileBloodType2El = document.getElementById('profileBloodType2');
  if (profileBloodType2El) profileBloodType2El.textContent = patientBloodType || '-';
  const cs2 = document.getElementById('compatSection2');
  const ct2 = document.getElementById('compatTags2');
  const dt = document.getElementById('donateTo');
  const dtTags = document.getElementById('donateToTags');

  if (cs2 && ct2) {
    if (patientBloodType && receiveFrom[patientBloodType]) {
      cs2.style.display = '';
      ct2.innerHTML = receiveFrom[patientBloodType]
        .map(t => '<span class="compat-tag receive">' + t + '</span>')
        .join('');
    } else {
      cs2.style.display = 'none';
      ct2.innerHTML = '';
    }
  }

  if (dt && dtTags) {
    if (patientBloodType && donateTo[patientBloodType]) {
      dt.style.display = '';
      dtTags.innerHTML = donateTo[patientBloodType]
        .map(t => '<span class="compat-tag receive">' + t + '</span>')
        .join('');
    } else {
      dt.style.display = 'none';
      dtTags.innerHTML = '';
    }
  }
}

(async () => {
  const result = await requireAuth();
  if (!result) return;

  const { profile } = result;
  applyProfileToUI(profile);
  renderDonorTypeFilters();

  if (profile.has_patient_profile) {
    // Load requests and keep existing realtime status behavior for patients.
    loadRequests();
    initRequestsRealtime();
  } else {
    const patientOnlyMessage = '<p style="text-align:center;color:var(--slate-400);padding:24px 0;">Enable Patient View to submit and track blood requests with this account.</p>';
    const requestList = document.getElementById('requestList');
    const dashboardRequestList = document.getElementById('dashboardRequestList');
    if (requestList) requestList.innerHTML = patientOnlyMessage;
    if (dashboardRequestList) dashboardRequestList.innerHTML = patientOnlyMessage;
  }

  if (profile.has_donor_profile) loadDonorDashboard();
  // Load blood drives
  renderBloodDrives();

  if (Object.prototype.hasOwnProperty.call(sectionTitles, linkedSection)) {
    navigateToSection(linkedSection);
  } else {
    navigateToSection('dashboard');
  }
})();

window.addEventListener('beforeunload', () => {
  if (requestSubscription && typeof requestSubscription.unsubscribe === 'function') {
    requestSubscription.unsubscribe();
  }
});


if (typeof attachPageRefreshListeners === 'function') {
  attachPageRefreshListeners({
    onRefresh: (info) => {
      refreshDashboardData(info);
    },
    debounceMs: 2500
  });
}


// ---- Profile Edit ----
function openProfileModal() {
  if (!currentProfile) return;
  if (!currentProfile.has_patient_profile) {
    showAccountRoleMessage('Enable Patient View before editing patient profile information.', 'info');
    openPatientView('profile');
    return;
  }

  const currentBloodType = (
    currentProfile.blood_type ||
    currentProfile.blood_type_needed ||
    currentProfile.donor_profile?.blood_type ||
    currentProfile.patient_profile?.blood_type_needed ||
    currentProfile.patient_profile?.blood_type ||
    ''
  ).trim().toUpperCase().replace(/\s+/g, '');
  const currentPhone = currentProfile.phone || currentProfile.contact_number || '';

  const fnInput = document.getElementById('profileFirstNameInput');
  if (fnInput) fnInput.value = currentProfile.first_name || '';
  const mnInput = document.getElementById('profileMiddleNameInput');
  if (mnInput) mnInput.value = currentProfile.middle_name || '';
  const lnInput = document.getElementById('profileLastNameInput');
  if (lnInput) lnInput.value = currentProfile.last_name || '';
  const btInput = document.getElementById('profileBloodTypeInput');
  if (btInput) btInput.value = currentBloodType;
  const genInput = document.getElementById('profileGenderInput');
  if (genInput) genInput.value = currentProfile.gender || '';
  const phInput = document.getElementById('profilePhoneInput');
  if (phInput) phInput.value = currentPhone;
  const addrInput = document.getElementById('profileAddressInput');
  if (addrInput) addrInput.value = currentProfile.address || '';
  pendingProfilePhoto = String(currentProfile.avatar_url || '');
  updateProfilePhotoPreview(pendingProfilePhoto);

  const msg = document.getElementById('profileMsg');
  if (msg) {
    msg.textContent = '';
    msg.className = 'form-msg';
  }
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.add('active');
}

function closeProfileModal() {
  const modal = document.getElementById('profileModal');
  if (modal) modal.classList.remove('active');
}

function updateProfilePhotoPreview(photoUrl) {
  const preview = document.getElementById('profilePhotoPreview');
  const previewInitials = document.getElementById('profilePhotoPreviewInitials');
  const initials = ((currentProfile?.first_name?.[0] || '') + (currentProfile?.last_name?.[0] || '')).toUpperCase() || 'P';
  previewInitials.textContent = initials;
  preview.classList.toggle('has-photo', Boolean(photoUrl));
  preview.style.backgroundImage = photoUrl ? `url("${photoUrl}")` : '';
}

function prepareProfilePhoto(file) {
  const msg = quickProfilePhotoMode
    ? document.getElementById('profilePhotoQuickMsg')
    : document.getElementById('profileMsg');
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    msg.textContent = 'Please select an image file.';
    msg.className = 'form-msg error';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    msg.textContent = 'Please choose a photo smaller than 10 MB.';
    msg.className = 'form-msg error';
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const image = new Image();
    image.onload = () => {
      const size = 320;
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext('2d');
      const sourceSize = Math.min(image.naturalWidth, image.naturalHeight);
      const sourceX = (image.naturalWidth - sourceSize) / 2;
      const sourceY = (image.naturalHeight - sourceSize) / 2;
      context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, size, size);
      pendingProfilePhoto = canvas.toDataURL('image/jpeg', .82);
      updateProfilePhotoPreview(pendingProfilePhoto);
      if (quickProfilePhotoMode) {
        try {
          saveProfilePhoto(currentProfile, pendingProfilePhoto);
          applyProfileToUI({ ...currentProfile, avatar_url: pendingProfilePhoto });
          closeProfilePhotoOptions();
          showProfileUpdateToast();
        } catch (error) {
          msg.textContent = error.message;
          msg.className = 'form-msg error';
        }
      } else {
        msg.textContent = 'Photo ready. Select Save Changes to apply it.';
        msg.className = 'form-msg info';
      }
    };
    image.onerror = () => {
      msg.textContent = 'That image could not be opened. Please try another photo.';
      msg.className = 'form-msg error';
    };
    image.src = String(reader.result);
  };
  reader.readAsDataURL(file);
}

document.getElementById('chooseProfilePhotoBtn').addEventListener('click', () => {
  quickProfilePhotoMode = false;
  document.getElementById('profilePhotoFileInput').click();
});
document.getElementById('takeProfilePhotoBtn').addEventListener('click', () => {
  quickProfilePhotoMode = false;
  document.getElementById('profilePhotoCameraInput').click();
});
['profilePhotoFileInput', 'profilePhotoCameraInput', 'quickProfilePhotoFileInput', 'quickProfilePhotoCameraInput'].forEach((inputId) => {
  document.getElementById(inputId).addEventListener('change', (event) => {
    prepareProfilePhoto(event.target.files?.[0]);
    event.target.value = '';
  });
});

function openProfilePhotoOptions() {
  if (!currentProfile) return;
  const msg = document.getElementById('profilePhotoQuickMsg');
  msg.textContent = '';
  msg.className = 'form-msg';
  document.getElementById('profilePhotoModal').classList.add('active');
}

function closeProfilePhotoOptions() {
  document.getElementById('profilePhotoModal').classList.remove('active');
  quickProfilePhotoMode = false;
}

document.getElementById('profileInitials').addEventListener('click', openProfilePhotoOptions);
document.getElementById('closeProfilePhotoModal').addEventListener('click', closeProfilePhotoOptions);
document.getElementById('cancelProfilePhotoBtn').addEventListener('click', closeProfilePhotoOptions);
document.getElementById('avatarChoosePhotoBtn').addEventListener('click', () => {
  quickProfilePhotoMode = true;
  document.getElementById('quickProfilePhotoFileInput').click();
});
document.getElementById('avatarTakePhotoBtn').addEventListener('click', () => {
  quickProfilePhotoMode = true;
  document.getElementById('quickProfilePhotoCameraInput').click();
});
document.getElementById('profilePhotoModal').addEventListener('click', (event) => {
  if (event.target === event.currentTarget) closeProfilePhotoOptions();
});

// ---- Logout ----
const sidebarLogoutBtn = document.getElementById('logoutBtn');
if (sidebarLogoutBtn) {
  sidebarLogoutBtn.addEventListener('click', (e) => {
    e.preventDefault();
    openLogoutModal(e);
  });
}

// ---- Blood Requests & Community Feed State ----
let allCommunityRequests = [];
let activeRequestsTab = 'community';
let activeCommunityFilter = 'all';
let activeMyFilter = 'all';
let selectedCommunityRequest = null;
let ignoredCommunityIds = new Set();
try {
  ignoredCommunityIds = new Set(JSON.parse(sessionStorage.getItem('veindrop_ignored_requests') || '[]'));
} catch (_) { }

function openRequestModal() {
  document.getElementById('requestModal').classList.add('active');
}
function closeRequestModal() {
  document.getElementById('requestModal').classList.remove('active');
  document.getElementById('requestForm').reset();
  document.getElementById('requestMsg').textContent = '';
  document.getElementById('requestMsg').className = 'form-msg';
}


function switchRequestsTab(tab) {
  activeRequestsTab = tab;
  const tabCommunityBtn = document.getElementById('tabCommunityRequests');
  const tabMyBtn = document.getElementById('tabMyRequests');
  const communityContent = document.getElementById('communityRequestsTabContent');
  const myContent = document.getElementById('myRequestsTabContent');

  if (tab === 'community') {
    tabCommunityBtn?.classList.add('active');
    tabCommunityBtn?.setAttribute('aria-selected', 'true');
    tabMyBtn?.classList.remove('active');
    tabMyBtn?.setAttribute('aria-selected', 'false');
    if (communityContent) { communityContent.hidden = false; communityContent.classList.add('active'); }
    if (myContent) { myContent.hidden = true; myContent.classList.remove('active'); }
    applyCommunityFilter();
  } else {
    tabMyBtn?.classList.add('active');
    tabMyBtn?.setAttribute('aria-selected', 'true');
    tabCommunityBtn?.classList.remove('active');
    tabCommunityBtn?.setAttribute('aria-selected', 'false');
    if (myContent) { myContent.hidden = false; myContent.classList.add('active'); }
    if (communityContent) { communityContent.hidden = true; communityContent.classList.remove('active'); }
    applyRequestFilter();
  }
}

function formatTimeAgo(isoString) {
  if (!isoString) return 'Recently';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  const dateStr = date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${timeStr}, ${dateStr}`;
}

function renderCommunityCard(r) {
  const isUrgent = String(r.urgency || '').toLowerCase() === 'urgent' || String(r.urgency || '').toLowerCase() === 'critical';
  const bloodTypeStr = escapeHtml(r.blood_type || 'O+');
  const units = Number(r.units_needed || 1);
  const donationPoint = escapeHtml(r.donation_point || r.hospital || 'General Hospital Blood Bank');
  const postedTime = formatTimeAgo(r.created_at);
  const description = escapeHtml(r.notes || 'Patient requires urgent blood transfusion support.');
  const reqId = r.id;
  const timeDateDisplay = escapeHtml(r.needed_time || (isUrgent ? 'As soon as possible' : 'Within 24-48 Hours'));

  return `
        <article class="feed-request-card" id="feedCard-${reqId}" data-request-id="${reqId}">
          <div class="feed-card-header">
            <div class="feed-requester-info">
              <div class="feed-requester-avatar" style="background:#fee2e2; color:#991b1b; display:flex; align-items:center; justify-content:center; font-weight:700;">
                <i class="fa-solid fa-droplet" aria-hidden="true"></i>
              </div>
              <div style="flex:1; min-width:0;">
                <h4 class="feed-requester-name" style="font-size:1.02rem; font-weight:700; color:#1e293b; margin:0 0 2px;">
                  Request #${reqId}
                </h4>
                <span class="feed-post-time"><i class="fa-regular fa-clock"></i> Posted on ${postedTime}</span>
              </div>
            </div>
          </div>

          <div class="feed-inner-box">
            <div class="feed-requirement-row">
              <div class="feed-blood-badge-wrap">
                <div class="feed-blood-droplet" aria-hidden="true">
                  <i class="fa-solid fa-droplet"></i>
                </div>
                <div>
                  <span class="feed-looking-label">LOOKING FOR</span>
                  <h3 class="feed-blood-title">${units} bag${units > 1 ? 's' : ''} ${bloodTypeStr} blood</h3>
                </div>
              </div>
              ${isUrgent ? `<span class="feed-urgent-badge"><i class="fa-solid fa-triangle-exclamation"></i> URGENT</span>` : ''}
            </div>

            <div class="feed-info-grid">
              <div class="feed-info-col">
                <span class="feed-info-label"><i class="fa-solid fa-location-dot"></i> Donation point</span>
                <p class="feed-info-val">${donationPoint}</p>
              </div>
              <div class="feed-info-col">
                <span class="feed-info-label"><i class="fa-regular fa-calendar-days"></i> Time &amp; Date</span>
                <p class="feed-info-val">${timeDateDisplay}</p>
              </div>
            </div>

            <div class="feed-desc-section">
              <span class="feed-desc-label">Short Description of the Problem</span>
              <p class="feed-desc-text">${description}</p>
            </div>
          </div>

          <div class="feed-actions-row">
            ${activeCommunityFilter === 'hidden'
      ? `<button type="button" class="btn-feed-ignore" onclick="unhideFeedCard('${reqId}')"><i class="fa-solid fa-eye"></i> Unhide</button>`
      : `<button type="button" class="btn-feed-ignore" onclick="hideFeedCard('${reqId}')">Hide</button>`
    }
            <button type="button" class="btn-feed-details" onclick="openCommunityRequestDetails('${reqId}')">Details</button>
          </div>
        </article>
      `;
}

function hideFeedCard(reqId) {
  const card = document.getElementById(`feedCard-${reqId}`) || document.getElementById(`myReqCard-${reqId}`);
  if (card) {
    card.style.transition = 'all 0.3s ease';
    card.style.opacity = '0';
    card.style.transform = 'scale(0.95) translateY(10px)';
    setTimeout(() => {
      ignoredCommunityIds.add(String(reqId));
      try {
        sessionStorage.setItem('veindrop_ignored_requests', JSON.stringify(Array.from(ignoredCommunityIds)));
      } catch (_) { }
      applyCommunityFilter();
      if (typeof applyRequestFilter === 'function') applyRequestFilter();
      showToastWithAction('Request hidden from feed.', 'Undo', () => {
        unhideFeedCard(reqId);
      });
    }, 300);
  } else {
    ignoredCommunityIds.add(String(reqId));
    try {
      sessionStorage.setItem('veindrop_ignored_requests', JSON.stringify(Array.from(ignoredCommunityIds)));
    } catch (_) { }
    applyCommunityFilter();
    if (typeof applyRequestFilter === 'function') applyRequestFilter();
  }
}

function unhideFeedCard(reqId) {
  ignoredCommunityIds.delete(String(reqId));
  try {
    sessionStorage.setItem('veindrop_ignored_requests', JSON.stringify(Array.from(ignoredCommunityIds)));
  } catch (_) { }
  applyCommunityFilter();
  if (typeof applyRequestFilter === 'function') applyRequestFilter();
  showToast('Request restored to feed.');
}

window.hideFeedCard = hideFeedCard;
window.unhideFeedCard = unhideFeedCard;

function openCommunityRequestDetails(reqId) {
  const req = allCommunityRequests.find(r => String(r.id) === String(reqId)) ||
    (Array.isArray(allPatientRequests) ? allPatientRequests.find(r => String(r.id || r.request_id) === String(reqId)) : null);
  if (!req) return;
  selectedCommunityRequest = req;

  const modal = document.getElementById('communityRequestDetailModal');
  const body = document.getElementById('communityRequestDetailBody');
  const isUrgent = String(req.urgency || '').toLowerCase() === 'urgent' || String(req.urgency || '').toLowerCase() === 'critical';
  const bloodType = escapeHtml(req.blood_type || req.blood_type_needed || 'O+');
  const units = Number(req.units_needed || req.quantity || 1);
  const hospital = escapeHtml(req.donation_point || req.hospital || req.hospital_name || 'Blood Bank Center');
  const description = escapeHtml(req.notes || req.note || 'Emergency blood transfusion required.');
  const contact = escapeHtml(req.patient_phone || 'Available via Hospital Blood Coordinator');
  const timeDateDisplay = escapeHtml(req.needed_time || (isUrgent ? 'As soon as possible' : 'Within 24-48 Hours'));

  body.innerHTML = `
        <div class="community-detail-info-card">
          <div class="community-detail-item">
            <span class="label"><i class="fa-solid fa-file-waveform"></i> Request</span>
            <span class="val" style="font-weight:700;">Request #${req.id || req.request_id}</span>
          </div>
          <div class="community-detail-item">
            <span class="label"><i class="fa-solid fa-droplet"></i> Blood Needed</span>
            <span class="val" style="color:var(--accent); font-size:1.1rem;">${units} Bag${units > 1 ? 's' : ''} (${bloodType})</span>
          </div>
          <div class="community-detail-item">
            <span class="label"><i class="fa-solid fa-shield-heart"></i> Urgency</span>
            <span class="val">${isUrgent ? '<span class="feed-urgent-badge"><i class="fa-solid fa-triangle-exclamation"></i> URGENT</span>' : 'Standard Routine'}</span>
          </div>
          <div class="community-detail-item">
            <span class="label"><i class="fa-solid fa-hospital"></i> Donation Point</span>
            <span class="val">${hospital}</span>
          </div>
          <div class="community-detail-item">
            <span class="label"><i class="fa-regular fa-calendar-days"></i> Time &amp; Date Needed</span>
            <span class="val">${timeDateDisplay}</span>
          </div>
          <div class="community-detail-item">
            <span class="label"><i class="fa-solid fa-phone"></i> Contact</span>
            <span class="val">${contact}</span>
          </div>
        </div>
        <div style="margin-top: 12px;">
          <h4 style="font-size:0.88rem; color:#7a6064; margin-bottom:4px; font-weight:700;">Reason / Problem Description:</h4>
          <p style="font-size:0.92rem; line-height:1.5; color:#2d1b1e; background:#fbf5f5; padding:12px; border-radius:10px; border:1px solid #f0dedf;">
            ${description}
          </p>
        </div>
        <div style="margin-top: 14px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 10px; color: #166534; font-size: 0.86rem; display: flex; gap: 8px; align-items: flex-start;">
          <i class="fa-solid fa-circle-info" style="margin-top:2px;"></i>
          <span>As a registered blood donor, your donation can directly save this recipient's life. Click respond below to pledge your support.</span>
        </div>
      `;

  modal?.classList.add('active');
}

function closeCommunityRequestDetailModal() {
  document.getElementById('communityRequestDetailModal')?.classList.remove('active');
  selectedCommunityRequest = null;
}

function handlePledgeHelp() {
  if (!selectedCommunityRequest) return;
  const req = selectedCommunityRequest;
  closeCommunityRequestDetailModal();

  try {
    sessionStorage.setItem('veindrop_pledge_request', JSON.stringify(req));
  } catch (e) {
    console.warn('Could not store pledge request in session:', e);
  }

  const reqId = encodeURIComponent(req.id || '');
  window.location.href = `donor_pledge_details.html?id=${reqId}`;
}


function isMyOwnRequest(r) {
  if (!r) return false;
  const myIds = new Set(
    (Array.isArray(allRequests) ? allRequests : [])
      .map(x => String(x.id || x.request_id))
      .filter(Boolean)
  );
  const reqId = String(r.id || r.request_id || '');
  if (reqId && myIds.has(reqId)) return true;

  const currentPatientId = currentProfile?.patient_id || currentProfile?.id;
  if (currentPatientId && String(r.patient_id) === String(currentPatientId)) return true;

  const currentUserId = currentProfile?.user_id;
  if (currentUserId && String(r.user_id) === String(currentUserId)) return true;

  return false;
}

function applyCommunityFilter() {
  const feed = document.getElementById('communityRequestFeed');
  if (!feed) return;

  const hiddenCountEl = document.getElementById('hiddenCount');
  if (hiddenCountEl) hiddenCountEl.textContent = ignoredCommunityIds.size;

  // Filter out own requests from the public community feed
  const othersRequests = allCommunityRequests.filter(r => !isMyOwnRequest(r));

  if (activeCommunityFilter === 'hidden') {
    const hiddenList = othersRequests.filter(r => ignoredCommunityIds.has(String(r.id)));
    const countEl = document.getElementById('communityCount');
    if (countEl) countEl.textContent = othersRequests.filter(r => !ignoredCommunityIds.has(String(r.id))).length;

    if (!hiddenList.length) {
      feed.innerHTML = `
            <div style="text-align:center; padding:48px 16px; background:#fff; border-radius:18px; border:1px solid rgba(0,0,0,0.06);">
              <i class="fa-solid fa-eye-slash" style="font-size:2.8rem; color:#800000; opacity:0.3; margin-bottom:12px;"></i>
              <h3 style="font-size:1.1rem; color:var(--slate-800); margin-bottom:6px;">No hidden requests</h3>
              <p style="color:var(--slate-500); font-size:0.88rem; max-width:320px; margin:0 auto;">You have not hidden any community requests.</p>
            </div>
          `;
      return;
    }

    feed.innerHTML = hiddenList.map(renderCommunityCard).join('');
    return;
  }

  const visible = othersRequests.filter(r => !ignoredCommunityIds.has(String(r.id)));
  const filtered = visible.filter(r => {
    if (activeCommunityFilter === 'urgent') {
      return String(r.urgency || '').toLowerCase() === 'urgent' || String(r.urgency || '').toLowerCase() === 'critical';
    }
    if (activeCommunityFilter !== 'all') {
      return normalizeBloodType(r.blood_type) === normalizeBloodType(activeCommunityFilter);
    }
    return true;
  });

  const countEl = document.getElementById('communityCount');
  if (countEl) countEl.textContent = visible.length;

  if (!filtered.length) {
    feed.innerHTML = `
          <div style="text-align:center; padding:48px 16px; background:#fff; border-radius:18px; border:1px solid rgba(0,0,0,0.06);">
            <i class="fa-solid fa-heart-circle-check" style="font-size:2.8rem; color:#800000; opacity:0.3; margin-bottom:12px;"></i>
            <h3 style="font-size:1.1rem; color:var(--slate-800); margin-bottom:6px;">No requests found</h3>
            <p style="color:var(--slate-500); font-size:0.88rem; max-width:320px; margin:0 auto;">There are no active community requests matching this filter right now.</p>
          </div>
        `;
    return;
  }

  feed.innerHTML = filtered.map(renderCommunityCard).join('');
}

async function loadCommunityRequests() {
  try {
    if (typeof listCommunityBloodRequests === 'function') {
      const { data } = await listCommunityBloodRequests();
      const rawList = Array.isArray(data) ? data : [];
      // Exclude user's own requests from the Community feed
      allCommunityRequests = rawList.filter(r => !isMyOwnRequest(r));
    }
  } catch (err) {
    console.warn('Failed to load community requests:', err);
  }
  applyCommunityFilter();
}

function renderRequestCard(r) {
  const reqId = r.id;
  const bloodTypeStr = escapeHtml(r.blood_type || 'O+');
  const units = Number(r.units_needed || 1);
  const isUrgent = String(r.urgency || '').toLowerCase() === 'urgent' || String(r.urgency || '').toLowerCase() === 'critical';
  const donationPoint = escapeHtml(r.donation_point || r.hospital || 'Blood Bank');
  const description = escapeHtml(r.notes || 'Blood transfusion support requested.');
  const postedTime = formatTimeAgo(r.created_at);
  const status = String(r.status || 'pending');
  const statusLabel = status === 'needs_clarification' ? 'Needs Clarification' : (status.charAt(0).toUpperCase() + status.slice(1));
  const canEdit = status === 'pending';
  const menuId = `myReqMenu-${reqId}`;
  const timeDateDisplay = escapeHtml(r.needed_time || (isUrgent ? 'As soon as possible' : 'Within 24-48 Hours'));

  return `
    <article class="feed-request-card" id="myReqCard-${reqId}" data-request-id="${reqId}">
      <div class="feed-card-header">
        <div class="feed-requester-info">
          <div class="feed-requester-avatar" style="background:#fee2e2; color:#991b1b; display:flex; align-items:center; justify-content:center; font-weight:700;">
            <i class="fa-solid fa-droplet" aria-hidden="true"></i>
          </div>
          <div style="flex:1; min-width:0;">
            <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:2px;">
              <h4 class="feed-requester-name" style="margin:0; font-size:1.02rem; font-weight:700; color:#1e293b;">
                Request #${reqId}
              </h4>
              <span class="feed-status-pill ${status}">${statusLabel}</span>
            </div>
            <span class="feed-post-time"><i class="fa-regular fa-clock"></i> Posted on ${postedTime}</span>
          </div>
        </div>
        <div class="my-req-menu-wrap" style="position:relative;">
          <button type="button" class="feed-options-btn" onclick="toggleMyReqMenu('${reqId}')" aria-label="Options" title="Options">
            <i class="fa-solid fa-ellipsis-vertical"></i>
          </button>
          <div class="my-req-dropdown" id="${menuId}" style="display:none;position:absolute;right:0;top:100%;background:#fff;border:1px solid #e2e8f0;border-radius:10px;box-shadow:0 4px 16px rgba(0,0,0,0.12);min-width:140px;z-index:200;overflow:hidden;">
            ${canEdit ? `<button type="button" class="my-req-menu-item" onclick="openEditRequestModal(${reqId})" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;background:none;border:none;cursor:pointer;font-size:0.875rem;color:#1e293b;"><i class="fa-solid fa-pen-to-square" style="color:var(--accent);"></i> Edit Request</button>` : ''}
            <button type="button" class="my-req-menu-item" onclick="openDeleteRequestModal(${reqId})" style="display:flex;align-items:center;gap:8px;width:100%;padding:10px 16px;background:none;border:none;cursor:pointer;font-size:0.875rem;color:var(--accent, #800000);"><i class="fa-solid fa-trash"></i> Delete Request</button>
          </div>
        </div>
      </div>

      <div class="feed-inner-box">
        <div class="feed-requirement-row">
          <div class="feed-blood-badge-wrap">
            <div class="feed-blood-droplet" aria-hidden="true">
              <i class="fa-solid fa-droplet"></i>
            </div>
            <div>
              <span class="feed-looking-label">LOOKING FOR</span>
              <h3 class="feed-blood-title">${units} bag${units > 1 ? 's' : ''} ${bloodTypeStr} blood</h3>
            </div>
          </div>
          ${isUrgent ? `<span class="feed-urgent-badge"><i class="fa-solid fa-triangle-exclamation"></i> URGENT</span>` : ''}
        </div>

        <div class="feed-info-grid">
          <div class="feed-info-col">
            <span class="feed-info-label"><i class="fa-solid fa-location-dot"></i> Donation point</span>
            <p class="feed-info-val">${donationPoint}</p>
          </div>
          <div class="feed-info-col">
            <span class="feed-info-label"><i class="fa-regular fa-calendar-days"></i> Time &amp; Date</span>
            <p class="feed-info-val">${timeDateDisplay}</p>
          </div>
        </div>

        <div class="feed-desc-section">
          <span class="feed-desc-label">Short Description of the Problem</span>
          <p class="feed-desc-text">${description || 'No description provided.'}</p>
        </div>
      </div>

      <div class="feed-actions-row">
        <button type="button" class="btn-feed-ignore" onclick="hideFeedCard('${reqId}')">Hide</button>
        <button type="button" class="btn-feed-details" onclick="openCommunityRequestDetails('${reqId}')">Details</button>
      </div>
    </article>
  `;
}

function toggleMyReqMenu(reqId) {
  const menuId = `myReqMenu-${reqId}`;
  document.querySelectorAll('.my-req-dropdown').forEach(m => {
    if (m.id !== menuId) m.style.display = 'none';
  });
  const menu = document.getElementById(menuId);
  if (menu) menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.my-req-menu-wrap')) {
    document.querySelectorAll('.my-req-dropdown').forEach(m => m.style.display = 'none');
  }
}, true);

function openEditRequestModal(reqId) {
  const r = (allRequests || []).find(x => String(x.id) === String(reqId));
  if (!r) return;
  document.getElementById('editReqId').value = reqId;
  const btSel = document.getElementById('editReqBloodType');
  if (btSel) btSel.value = r.blood_type || '';
  const unitIn = document.getElementById('editReqUnits');
  if (unitIn) unitIn.value = r.units_needed || 1;
  const urgSel = document.getElementById('editReqUrgency');
  if (urgSel) urgSel.value = r.urgency || 'normal';
  const hospIn = document.getElementById('editReqHospital');
  if (hospIn) hospIn.value = r.donation_point || r.hospital || '';
  const timeIn = document.getElementById('editReqNeededTime');
  if (timeIn) timeIn.value = r.needed_time || '';
  const notesIn = document.getElementById('editReqNotes');
  if (notesIn) notesIn.value = r.notes || '';
  const msgEl = document.getElementById('editReqMsg');
  if (msgEl) { msgEl.textContent = ''; msgEl.className = 'form-msg'; }
  document.getElementById('editRequestModal').classList.add('active');
}

function closeEditRequestModal() {
  document.getElementById('editRequestModal').classList.remove('active');
}

let pendingDeleteRequestId = null;

function openDeleteRequestModal(reqId) {
  pendingDeleteRequestId = reqId;
  document.querySelectorAll('.my-req-dropdown').forEach(m => m.style.display = 'none');
  const modal = document.getElementById('deleteRequestModal');
  if (modal) modal.classList.add('active');
}

function closeDeleteRequestModal() {
  pendingDeleteRequestId = null;
  const modal = document.getElementById('deleteRequestModal');
  if (modal) modal.classList.remove('active');
}

const deleteReqModal = document.getElementById('deleteRequestModal');
if (deleteReqModal) {
  deleteReqModal.addEventListener('click', (e) => {
    if (e.target === deleteReqModal) closeDeleteRequestModal();
  });
}

function showToast(message, type = 'success') {
  let container = document.getElementById('patientToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'patientToastContainer';
    container.className = 'patient-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `patient-toast ${type}`;
  const iconHtml = type === 'success'
    ? '<i class="fa-solid fa-circle-check"></i>'
    : '<i class="fa-solid fa-circle-exclamation"></i>';
  toast.innerHTML = `${iconHtml} <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function showToastWithAction(message, actionText, actionCallback) {
  let container = document.getElementById('patientToastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'patientToastContainer';
    container.className = 'patient-toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'patient-toast info';
  toast.innerHTML = `
    <i class="fa-solid fa-eye-slash"></i>
    <span>${escapeHtml(message)}</span>
    <button type="button" class="patient-toast-action-btn">${escapeHtml(actionText)}</button>
  `;
  container.appendChild(toast);

  const actionBtn = toast.querySelector('.patient-toast-action-btn');
  let isActionClicked = false;
  if (actionBtn && typeof actionCallback === 'function') {
    actionBtn.addEventListener('click', () => {
      isActionClicked = true;
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
      actionCallback();
    });
  }

  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  setTimeout(() => {
    if (!isActionClicked && toast.parentElement) {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }
  }, 4500);
}

const confirmDeleteReqBtn = document.getElementById('confirmDeleteReqBtn');
if (confirmDeleteReqBtn) {
  confirmDeleteReqBtn.addEventListener('click', async () => {
    if (!pendingDeleteRequestId) return;
    const reqIdToDelete = pendingDeleteRequestId;
    confirmDeleteReqBtn.disabled = true;
    confirmDeleteReqBtn.textContent = 'Deleting...';
    try {
      const { error } = await deleteMyBloodRequest(reqIdToDelete);
      if (error) {
        showToast(error.message || 'Failed to delete request.', 'error');
      } else {
        // Immediate local removal from cache
        allRequests = (allRequests || []).filter(r => String(r.id) !== String(reqIdToDelete));
        const cardEl = document.getElementById(`myReqCard-${reqIdToDelete}`);
        if (cardEl) cardEl.remove();
        applyRequestFilter();
        closeDeleteRequestModal();
        showToast('Blood request deleted successfully.');
        await loadRequests();
      }
    } catch (err) {
      console.error('Delete request error:', err);
      showToast('Network error. Failed to delete request.', 'error');
    } finally {
      confirmDeleteReqBtn.disabled = false;
      confirmDeleteReqBtn.textContent = 'Yes, delete';
    }
  });
}

window.toggleMyReqMenu = toggleMyReqMenu;
window.openEditRequestModal = openEditRequestModal;
window.closeEditRequestModal = closeEditRequestModal;
window.openDeleteRequestModal = openDeleteRequestModal;
window.closeDeleteRequestModal = closeDeleteRequestModal;
window.confirmDeleteRequest = openDeleteRequestModal;

function applyRequestFilter() {
  const fullList = document.getElementById('requestList');
  const emptyMsg = '<p style="text-align:center;color:var(--slate-400);padding:24px 0;">No requests for this filter yet.</p>';

  const filtered = (allRequests || []).filter((r) => {
    if (activeMyFilter === 'pending') {
      return r.status === 'pending' || r.status === 'processing';
    }
    if (activeMyFilter === 'approved') {
      return r.status === 'approved';
    }
    if (activeMyFilter === 'needs_clarification') {
      return r.status === 'needs_clarification';
    }
    if (activeMyFilter === 'rejected') {
      return r.status === 'rejected';
    }
    if (activeMyFilter === 'fulfilled') {
      return r.status === 'fulfilled';
    }
    return true;
  });

  if (fullList) fullList.innerHTML = filtered.length ? filtered.map(renderRequestCard).join('') : emptyMsg;
}

async function loadRequests() {
  const emptyMsg = '<p style="text-align:center;color:var(--slate-400);padding:24px 0;">No blood requests yet. Click Create Request above to submit one.</p>';

  // Load community feed as well
  loadCommunityRequests();

  try {
    const { data: requests, error } = await listMyBloodRequests();
    const fullList = document.getElementById('requestList');
    const dashList = document.getElementById('dashboardRequestList');

    if (error) {
      throw error;
    }

    if (!requests || requests.length === 0) {
      allRequests = [];
      if (fullList) fullList.innerHTML = emptyMsg;
      if (dashList) dashList.innerHTML = emptyMsg;
      const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setCount('myRequestsCount', '0');
      setCount('requestBadge', '0');
      return;
    }

    allRequests = requests;

    const fulfilled = requests.filter(r => r.status === 'fulfilled').length;
    const pending = requests.filter(r => r.status === 'pending' || r.status === 'processing').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const clarification = requests.filter(r => r.status === 'needs_clarification').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;

    // Update stats on dashboard and requests section
    ['statTotalRequests', 'statTotalRequests2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = requests.length;
    });
    ['statFulfilled', 'statFulfilled2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = fulfilled;
    });
    ['statPending', 'statPending2'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = pending;
    });

    // Update filter menu counts (null-safe)
    const setCount = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setCount('myRequestsCount', requests.length);
    setCount('requestBadge', requests.length);

    const badge = document.getElementById('requestBadge');
    if (badge) badge.textContent = requests.length;

    // Full list in My Requests section (filtered)
    applyRequestFilter();
    applyCommunityFilter();

    // Recent 3 on dashboard
    if (dashList) dashList.innerHTML = requests.slice(0, 3).map(renderRequestCard).join('');
  } catch (err) {
    console.error('Failed to load requests:', err);
    const readable = err?.message ? `Failed to load requests: ${err.message}` : 'Failed to load requests. Please try again.';
    const fullList = document.getElementById('requestList');
    const dashList = document.getElementById('dashboardRequestList');
    if (fullList) fullList.innerHTML = `<p style="text-align:center;color:var(--accent);padding:24px 0;">${readable}</p>`;
    if (dashList) dashList.innerHTML = `<p style="text-align:center;color:var(--accent);padding:24px 0;">${readable}</p>`;
  }
}

// Filter dropdown toggle and option selection for Community Blood Requests
const filterDropdown = document.getElementById('filterDropdown');
const filterTrigger = document.getElementById('filterTrigger');

if (filterTrigger) {
  filterTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = filterDropdown.classList.contains('open');
    filterDropdown.classList.toggle('open', !isOpen);
    filterTrigger.setAttribute('aria-expanded', !isOpen);
  });
}

document.addEventListener('click', (e) => {
  if (filterDropdown && !filterDropdown.contains(e.target)) {
    filterDropdown.classList.remove('open');
    filterTrigger?.setAttribute('aria-expanded', 'false');
  }
  // Close myFilterDropdown on outside click
  if (myFilterDropdown && !myFilterDropdown.contains(e.target)) {
    myFilterDropdown.classList.remove('open');
    myFilterTrigger?.setAttribute('aria-expanded', 'false');
  }
});

// Community filter items — scoped to #filterMenu only
document.querySelectorAll('#filterMenu .filter-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#filterMenu .filter-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');

    activeCommunityFilter = btn.getAttribute('data-request-filter') || 'all';
    applyCommunityFilter();

    // Sync trigger text
    const triggerText = document.getElementById('selectedFilterText');
    if (triggerText) triggerText.textContent = btn.querySelector('span')?.textContent?.trim() || btn.textContent.trim();

    filterDropdown?.classList.remove('open');
    filterTrigger?.setAttribute('aria-expanded', 'false');
  });
});

// My Requests Filter Dropdown
const myFilterDropdown = document.getElementById('myFilterDropdown');
const myFilterTrigger = document.getElementById('myFilterTrigger');

if (myFilterTrigger) {
  myFilterTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = myFilterDropdown?.classList.contains('open');
    myFilterDropdown?.classList.toggle('open', !isOpen);
    myFilterTrigger.setAttribute('aria-expanded', String(!isOpen));
  });
}

document.querySelectorAll('#myFilterMenu .my-filter-item').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#myFilterMenu .my-filter-item').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    activeMyFilter = btn.getAttribute('data-my-filter') || 'all';

    // Update trigger label to selected option name
    const label = btn.querySelector('span')?.textContent?.trim() || 'All Requests';
    const selectedText = document.getElementById('selectedMyFilterText');
    if (selectedText) selectedText.textContent = label;

    applyRequestFilter();
    myFilterDropdown?.classList.remove('open');
    myFilterTrigger?.setAttribute('aria-expanded', 'false');
  });
});

// Expose functions globally for inline HTML handlers
window.switchRequestsTab = switchRequestsTab;
window.ignoreFeedCard = ignoreFeedCard;
window.openCommunityRequestDetails = openCommunityRequestDetails;
window.closeCommunityRequestDetailModal = closeCommunityRequestDetailModal;
window.handlePledgeHelp = handlePledgeHelp;
window.openRequestModal = openRequestModal;
window.closeRequestModal = closeRequestModal;

document.getElementById('requestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('requestMsg');
  const form = e.target;
  const formData = new FormData(form);
  const body = {};
  formData.forEach((v, k) => body[k] = v);

  msg.textContent = 'Submitting request...';
  msg.className = 'form-msg info';

  try {
    const result = await createBloodRequest(body);
    const error = result?.error;

    if (error) {
      msg.textContent = error.message || 'Failed to submit request.';
      msg.className = 'form-msg error';
      return;
    }

    const note = result?.data?.note || '';
    if (note.includes('[Community Crowdsourced]')) {
      msg.textContent = 'Request submitted! Nearby donors have been alerted.';
    } else {
      msg.textContent = 'Blood request submitted successfully!';
    }
    msg.className = 'form-msg success';
    loadRequests();
    setTimeout(closeRequestModal, 1800);
  } catch (err) {
    msg.textContent = 'Network error. Please try again.';
    msg.className = 'form-msg error';
  }
});

document.getElementById('editRequestForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = document.getElementById('editReqMsg');
  const reqId = document.getElementById('editReqId').value;
  const payload = {
    blood_type: document.getElementById('editReqBloodType').value,
    units_needed: document.getElementById('editReqUnits').value,
    urgency: document.getElementById('editReqUrgency').value,
    hospital: document.getElementById('editReqHospital').value,
    needed_time: document.getElementById('editReqNeededTime')?.value || '',
    notes: document.getElementById('editReqNotes').value
  };

  msg.textContent = 'Saving changes...';
  msg.className = 'form-msg info';

  try {
    const { error } = await updateMyBloodRequest(reqId, payload);
    if (error) {
      msg.textContent = error.message || 'Failed to update request.';
      msg.className = 'form-msg error';
      return;
    }
    msg.textContent = 'Request updated successfully!';
    msg.className = 'form-msg success';
    loadRequests();
    setTimeout(closeEditRequestModal, 1500);
  } catch (err) {
    msg.textContent = 'Network error. Please try again.';
    msg.className = 'form-msg error';
  }
});

document.getElementById('profileForm').addEventListener('submit', async (e) => {
  e.preventDefault();

  const msg = document.getElementById('profileMsg');
  const saveBtn = document.getElementById('profileSaveBtn');
  const formData = new FormData(e.target);

  const payload = {
    first_name: String(formData.get('first_name') || '').trim(),
    middle_name: String(formData.get('middle_name') || '').trim(),
    last_name: String(formData.get('last_name') || '').trim(),
    blood_type: String(formData.get('blood_type') || '').trim(),
    gender: String(formData.get('gender') || '').trim(),
    phone: String(formData.get('phone') || '').trim(),
    address: String(formData.get('address') || '').trim()
  };

  if (!payload.first_name || !payload.last_name || !payload.blood_type) {
    msg.textContent = 'First name, last name, and blood type are required.';
    msg.className = 'form-msg error';
    return;
  }

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  msg.textContent = 'Saving profile...';
  msg.className = 'form-msg info';

  try {
    if (typeof updateMyPatientProfile !== 'function') {
      throw new Error('Profile update module not loaded. Please hard refresh the page and try again.');
    }

    const { data, error } = await updateMyPatientProfile(payload);

    if (error) {
      msg.textContent = error.message || 'Failed to update profile.';
      msg.className = 'form-msg error';
      return;
    }

    saveProfilePhoto(data.profile, pendingProfilePhoto);
    applyProfileToUI({ ...data.profile, avatar_url: pendingProfilePhoto });
    msg.textContent = 'Profile updated successfully.';
    msg.className = 'form-msg success';
    setTimeout(closeProfileModal, 900);
  } catch (err) {
    console.error('Failed to update profile:', err);
    msg.textContent = err?.message || 'Network error. Please try again.';
    msg.className = 'form-msg error';
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Changes';
  }
});

// ---- Logout Functionality ----
function toggleHeaderDropdown(event) {
  if (event) event.stopPropagation();
  if (!headerDropdown) return;
  const isOpen = headerDropdown.classList.contains('active');
  if (isOpen) {
    closeHeaderDropdown();
    return;
  }
  setSidebarOpen(false);
  openHeaderDropdown();
}

if (headerDropdownOverlay) {
  headerDropdownOverlay.addEventListener('click', closeHeaderDropdown);
}

function openProfileFromDropdown(event) {
  if (event) event.stopPropagation();
  closeHeaderDropdown();
  closeNotificationPanel();
  navigateToSection('profile');
}

// Close dropdown when clicking outside
window.addEventListener('click', (event) => {
  const target = event.target;
  if (headerDropdown && headerProfileBtn && (headerProfileBtn.contains(target) || headerDropdown.contains(target))) return;
  if (notificationPanel && notificationBtn && (notificationBtn.contains(target) || notificationPanel.contains(target))) return;
  closeHeaderDropdown();
  closeNotificationPanel();
});

window.addEventListener('scroll', () => {
  closeHeaderDropdown();
  closeNotificationPanel();
}, { passive: true });

function openLogoutModal(event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }
  const dropdown = document.getElementById('headerProfileDropdown');
  if (dropdown) dropdown.classList.remove('active');
  if (typeof closeNotificationPanel === 'function') closeNotificationPanel();
  if (typeof setSidebarOpen === 'function') setSidebarOpen(false);
  document.body.classList.add('modal-open');
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.classList.add('active');
}
window.openLogoutModal = openLogoutModal;

function closeLogoutModal(event) {
  if (event && typeof event.stopPropagation === 'function') event.stopPropagation();
  const modal = document.getElementById('logoutConfirmModal');
  if (modal) modal.classList.remove('active');
  document.body.classList.remove('modal-open');
}
window.closeLogoutModal = closeLogoutModal;

async function handleConfirmLogout(event) {
  if (event) {
    if (typeof event.preventDefault === 'function') event.preventDefault();
    if (typeof event.stopPropagation === 'function') event.stopPropagation();
  }
  const btn = document.getElementById('confirmLogoutBtn');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
  }

  // Guaranteed fallback redirect if anything delays
  const fallbackRedirect = setTimeout(() => {
    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch (_) { }
    window.location.replace('login.html');
  }, 700);

  try {
    if (typeof signOut === 'function') {
      await signOut();
    } else {
      if (typeof clearAuthSession === 'function') {
        await clearAuthSession();
      }
      window.location.replace('login.html');
    }
  } catch (err) {
    console.warn('Logout error:', err);
    window.location.replace('login.html');
  } finally {
    clearTimeout(fallbackRedirect);
  }
}
window.handleConfirmLogout = handleConfirmLogout;

const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
if (confirmLogoutBtn) {
  confirmLogoutBtn.addEventListener('click', handleConfirmLogout);
}


// ----- Request admin-note modal -----
function openRequestNoteModal(requestId, noteText) {
  const modal = document.getElementById('requestNoteModal');
  const noteBody = document.getElementById('requestNoteContent');
  const noteTitle = document.getElementById('requestNoteTitle');
  if (noteTitle) noteTitle.textContent = `Admin note - Request ${requestId || ''}`;
  if (noteBody) noteBody.textContent = noteText || 'No note available.';
  if (modal) modal.classList.add('active');
}

function closeRequestNoteModal() {
  const modal = document.getElementById('requestNoteModal');
  if (modal) modal.classList.remove('active');
}
