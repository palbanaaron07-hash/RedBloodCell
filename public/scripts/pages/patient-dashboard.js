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
      dashboard: { title: 'Patient Overview', sub: 'Manage your blood requests here' },
      requests: { title: 'My Requests', sub: 'View and track all your blood requests' },
      drives: { title: 'Blood Drives', sub: 'View upcoming blood drive campaigns in your area' },
      donor: { title: 'Donor Center', sub: 'Manage your donor profile, eligibility, and availability' },
      profile: { title: 'My Profile', sub: 'View and manage your personal information' },
      help: { title: 'Help & Support', sub: 'Frequently asked questions and support' }
    };

    function activateSectionView(sectionName) {
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
        document.querySelector('.header-title h1').textContent = info.title;
        document.querySelector('.header-title p').textContent = info.sub;
      }

      const donorViewButton = document.getElementById('donorViewBtn');
      if (donorViewButton) donorViewButton.classList.toggle('active', sectionName === 'donor');
      return target;
    }

    function navigateToSection(sectionName) {
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

      if (sectionName === 'donor') {
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
      const dashboardSubtitle = `${greeting}, ${firstName} - manage your blood requests here`;
      const heroTitle = document.getElementById('heroTitle');

      sectionTitles.dashboard.sub = dashboardSubtitle;
      if (heroTitle) heroTitle.textContent = `${greeting}, ${shortGreetingName}`;
      if (document.getElementById('section-dashboard')?.classList.contains('active')) {
        const headerGreeting = document.getElementById('headerGreeting');
        if (headerGreeting) headerGreeting.textContent = dashboardSubtitle;
      }

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

    // Blood Drives data
    const BLOOD_DRIVE_PLAN = [
      {
        drive_id: 'DR-2026-05-08',
        drive_name: 'City Hall Community Drive',
        date: '2026-05-08',
        venue: 'City Hall Atrium',
        target_units: 80,
        registered_donors: 52,
        focus_type: 'O-',
        status: 'recruiting'
      },
      {
        drive_id: 'DR-2026-05-15',
        drive_name: 'University Medical Outreach',
        date: '2026-05-15',
        venue: 'State University Gym',
        target_units: 70,
        registered_donors: 49,
        focus_type: 'A-',
        status: 'recruiting'
      },
      {
        drive_id: 'DR-2026-05-22',
        drive_name: 'Industrial Park Donation Day',
        date: '2026-05-22',
        venue: 'North Industrial Clinic',
        target_units: 60,
        registered_donors: 60,
        focus_type: 'B+',
        status: 'full'
      },
      {
        drive_id: 'DR-2026-04-18',
        drive_name: 'Barangay Weekend Blood Drive',
        date: '2026-04-18',
        venue: 'Barangay Multipurpose Hall',
        target_units: 55,
        registered_donors: 57,
        focus_type: 'AB-',
        status: 'completed'
      }
    ];

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
        try { marker.remove(); } catch (_) {}
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
        } catch (_) {}
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

    function initRequestsRealtime() {
      if (typeof subscribeToRequestChanges !== 'function') return;
      // Unsubscribe existing
      if (requestSubscription && typeof requestSubscription.unsubscribe === 'function') {
        try { requestSubscription.unsubscribe(); } catch (_) {}
      }
      const patientId = currentProfile?.patient_id || currentProfile?.id || null;
      if (!patientId) return;
      requestSubscription = subscribeToRequestChanges(patientId, () => {
        loadRequests();
      });
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
      try { localStorage.setItem(preferredViewStorageKey(), view); } catch (_) {}
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

    function renderDonorDashboard(data) {
      const donor = data?.donor;
      if (!donor) return;

      donorDashboardData = data;
      const status = String(donor.donor_status || 'registered').toLowerCase();
      const availability = String(donor.availability_status || 'unavailable').toLowerCase();
      const eligibility = typeof isEligibleToCheckIn === 'function'
        ? isEligibleToCheckIn(donor)
        : { eligible: !donor.last_donation_date, daysRemaining: 0 };
      const medicallyDeferred = status === 'deferred';
      const eligible = eligibility.eligible && !medicallyDeferred;
      const lastDonation = donor.last_donation_date ? new Date(`${donor.last_donation_date}T00:00:00`) : null;
      const nextEligible = lastDonation ? new Date(lastDonation.getTime() + 56 * 24 * 60 * 60 * 1000) : null;

      document.getElementById('donorEligibilityStat').textContent = medicallyDeferred ? 'Deferred' : (eligible ? 'Eligible' : 'Waiting');
      document.getElementById('donorEligibilitySub').textContent = medicallyDeferred
        ? (donor.deferred_reason || 'Staff clearance required')
        : (eligible ? 'Eligible for donor check-in' : `${eligibility.daysRemaining || 0} day(s) remaining`);
      document.getElementById('donorAvailabilityStat').textContent = availability === 'available' ? 'Available' : 'Paused';
      document.getElementById('donorLastDonationStat').textContent = lastDonation
        ? lastDonation.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No history';
      document.getElementById('donorNextEligibleStat').textContent = nextEligible
        ? nextEligible.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'Now';

      document.getElementById('donorBloodType').textContent = donor.blood_type || '--';
      document.getElementById('donorProfileName').textContent = formatPatientDisplayName(donor);
      document.getElementById('donorProfileId').textContent = `Donor ID ${donor.donor_id || '--'}`;

      const lifecycleBadge = document.getElementById('donorLifecycleBadge');
      lifecycleBadge.textContent = formatDonorStatus(status);
      lifecycleBadge.className = `badge ${typeof getDonorLifecycleBadgeClass === 'function' ? getDonorLifecycleBadgeClass(status) : status}`;

      const availabilityToggle = document.getElementById('donorAvailabilityToggle');
      const isAvailable = availability === 'available';
      availabilityToggle.setAttribute('aria-pressed', isAvailable ? 'true' : 'false');
      availabilityToggle.querySelector('strong').textContent = isAvailable ? 'On' : 'Off';
      availabilityToggle.disabled = medicallyDeferred || (!eligible && !isAvailable);
      document.getElementById('donorAvailabilityHelp').textContent = medicallyDeferred
        ? 'Availability is locked until staff clears the deferral.'
        : (!eligible && !isAvailable
          ? 'Availability unlocks after the 56-day waiting period.'
          : 'Pause this when you cannot donate.');

      const history = Array.isArray(data.donations) ? data.donations : [];
      const historyElement = document.getElementById('donorDonationHistory');
      historyElement.innerHTML = history.length ? history.map((item) => `
        <article class="donor-activity-item">
          <i class="fa-solid fa-droplet" aria-hidden="true"></i>
          <div><strong>${escapeHtml(item.blood_type || donor.blood_type || '--')} donation</strong><span>${formatNumber(item.quantity || 0)} unit(s)</span></div>
          <time datetime="${escapeHtml(item.donation_date || '')}">${formatDateShort(item.donation_date)}</time>
        </article>
      `).join('') : '<p class="donor-empty-state">No completed donations have been recorded yet.</p>';

      const matches = Array.isArray(data.matching_requests) ? data.matching_requests : [];
      document.getElementById('donorMatchCount').textContent = `${matches.length} match${matches.length === 1 ? '' : 'es'}`;
      document.getElementById('donorMatchingRequests').innerHTML = matches.length ? matches.map((request) => {
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

    function applyProfileToUI(profile) {
      if (!profile) return;

      currentProfile = profile;
      renderAccountRoleControls(profile);
      const patientBloodType = profile.blood_type || profile.blood_type_needed || '';
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

      const avatarUrl = String(profile.avatar_url || getSavedProfilePhoto(profile)).trim();
      currentProfile.avatar_url = avatarUrl;
      if (headerInitials) {
        headerInitials.classList.toggle('has-photo', Boolean(avatarUrl));
        headerInitials.style.backgroundImage = avatarUrl ? `url("${avatarUrl}")` : '';
        if (!avatarUrl) headerInitials.textContent = initials.toUpperCase();
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
      document.getElementById('profileName').textContent = fullName;
      document.getElementById('profileEmail').textContent = profile.email;
      document.getElementById('profileBloodType').textContent = patientBloodType || '-';
      document.getElementById('profilePhone').textContent = patientPhone || '-';
      document.getElementById('profileGender').textContent = patientGender
        ? patientGender.charAt(0).toUpperCase() + patientGender.slice(1) : '-';
      document.getElementById('profileAddress').textContent = patientAddress || '-';
      document.getElementById('profileSince').textContent = profile.created_at
        ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : '-';

      // Blood type stat
      document.getElementById('statBloodType').textContent = patientBloodType || '-';
      const statBloodType2 = document.getElementById('statBloodType2');
      if (statBloodType2) statBloodType2.textContent = patientBloodType || '-';

      // Pre-select blood type in request form
      if (patientBloodType) {
        document.getElementById('requestBloodType').value = patientBloodType;
      }

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
      document.getElementById('profileBloodType2').textContent = patientBloodType || '-';
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
      } else if (profile.has_donor_profile && getPreferredDashboardView() === 'donor') {
        navigateToSection('donor');
      } else if (profile.has_donor_profile && !profile.has_patient_profile) {
        navigateToSection('donor');
      }
    })();

    window.addEventListener('beforeunload', () => {
      if (requestSubscription && typeof requestSubscription.unsubscribe === 'function') {
        requestSubscription.unsubscribe();
      }
    });

    // ---- Profile Edit ----
    function openProfileModal() {
      if (!currentProfile) return;
      if (!currentProfile.has_patient_profile) {
        showAccountRoleMessage('Enable Patient View before editing patient profile information.', 'info');
        openPatientView('profile');
        return;
      }

      const currentBloodType = currentProfile.blood_type || currentProfile.blood_type_needed || '';
      const currentPhone = currentProfile.phone || currentProfile.contact_number || '';

      document.getElementById('profileFirstNameInput').value = currentProfile.first_name || '';
      document.getElementById('profileMiddleNameInput').value = currentProfile.middle_name || '';
      document.getElementById('profileLastNameInput').value = currentProfile.last_name || '';
      document.getElementById('profileBloodTypeInput').value = currentBloodType;
      document.getElementById('profileGenderInput').value = currentProfile.gender || '';
      document.getElementById('profilePhoneInput').value = currentPhone;
      document.getElementById('profileAddressInput').value = currentProfile.address || '';
      pendingProfilePhoto = String(currentProfile.avatar_url || '');
      updateProfilePhotoPreview(pendingProfilePhoto);

      const msg = document.getElementById('profileMsg');
      msg.textContent = '';
      msg.className = 'form-msg';
      document.getElementById('profileModal').classList.add('active');
    }

    function closeProfileModal() {
      document.getElementById('profileModal').classList.remove('active');
      const msg = document.getElementById('profileMsg');
      msg.textContent = '';
      msg.className = 'form-msg';
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
    document.getElementById('logoutBtn').addEventListener('click', async (e) => {
      e.preventDefault();
      await signOut();
    });

    // ---- Blood Requests ----
    function openRequestModal() {
      document.getElementById('requestModal').classList.add('active');
    }
    function closeRequestModal() {
      document.getElementById('requestModal').classList.remove('active');
      document.getElementById('requestForm').reset();
      document.getElementById('requestMsg').textContent = '';
      document.getElementById('requestMsg').className = 'form-msg';
      // Re-select blood type
      const currentBloodType = currentProfile?.blood_type || currentProfile?.blood_type_needed || '';
      if (currentBloodType) {
        document.getElementById('requestBloodType').value = currentBloodType;
      }
    }

    function renderRequestCard(r) {
      const rawDate = r.created_at ? new Date(r.created_at) : null;
      const date = rawDate && !Number.isNaN(rawDate.getTime())
        ? rawDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        : 'No date';
      const status = String(r.status || 'pending');
      const statusClass = status;
      const adminNote = r.admin_note || r.admin_message || r.admin_comment || r.note || '';
      const urgency = String(r.urgency || 'normal');
      const urgencyLabel = urgency.charAt(0).toUpperCase() + urgency.slice(1);
      const unitsNeeded = Number(r.units_needed || 0);
      const notesHtml = r.notes ? `<span>${r.notes}</span>` : '';
      const statusLabel = status === 'needs_clarification' ? 'Needs Clarification' : (status.charAt(0).toUpperCase() + status.slice(1));
      return `
        <div class="request-card" ${adminNote ? `onclick='openRequestNoteModal(${Number(r.id || r.request_id || 0)}, ${JSON.stringify(adminNote).replace(/'/g, "&#39;")})' style="cursor:pointer;" title="Click to view admin note"` : ''}>
          <div class="request-type">${r.blood_type || '-'}</div>
          <div class="request-info">
            <strong>${r.hospital || 'Blood Bank'} &bull; ${unitsNeeded} unit${unitsNeeded > 1 ? 's' : ''}</strong>
            ${notesHtml}
          </div>
          <div class="request-meta">
            <span class="badge ${statusClass}">${statusLabel}</span>
            <span class="badge ${urgency}" style="margin-left:4px;">${urgencyLabel}</span>
            <small>${date}</small>
          </div>
        </div>
      `;
    }

    function applyRequestFilter() {
      const fullList = document.getElementById('requestList');
      const emptyMsg = '<p style="text-align:center;color:var(--slate-400);padding:24px 0;">No requests for this filter yet.</p>';

      const filtered = (allRequests || []).filter((r) => {
        if (activeRequestFilter === 'pending') {
          return r.status === 'pending' || r.status === 'processing';
        }
        if (activeRequestFilter === 'approved') {
          return r.status === 'approved';
        }
        if (activeRequestFilter === 'needs_clarification') {
          return r.status === 'needs_clarification';
        }
        if (activeRequestFilter === 'rejected') {
          return r.status === 'rejected';
        }
        if (activeRequestFilter === 'fulfilled') {
          return r.status === 'fulfilled';
        }
        return true;
      });

      fullList.innerHTML = filtered.length ? filtered.map(renderRequestCard).join('') : emptyMsg;
    }

    async function loadRequests() {
      const emptyMsg = '<p style="text-align:center;color:var(--slate-400);padding:24px 0;">No blood requests yet. Go to My Requests to create one.</p>';
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
          ['statTotalRequests', 'statTotalRequests2', 'statFulfilled', 'statFulfilled2', 'statPending', 'statPending2', 'requestBadge'].forEach(id => setCount(id, '0'));
          setCount('requestsAllCountMenu', '0');
          setCount('requestsPendingCountMenu', '0');
          setCount('requestsApprovedCountMenu', '0');
          setCount('requestsClarificationCountMenu', '0');
          setCount('requestsRejectedCountMenu', '0');
          setCount('requestsFulfilledCountMenu', '0');

          const activeItem = document.querySelector('.filter-item.active');
          const triggerText = document.getElementById('selectedFilterText');
          if (activeItem && triggerText) {
            triggerText.textContent = activeItem.textContent;
          }
          return;
        }

        allRequests = requests;

        const fulfilled = requests.filter(r => r.status === 'fulfilled').length;
        const pending = requests.filter(r => r.status === 'pending' || r.status === 'processing').length;
        const approved = requests.filter(r => r.status === 'approved').length;
        const clarification = requests.filter(r => r.status === 'needs_clarification').length;
        const rejected = requests.filter(r => r.status === 'rejected').length;

        // Update stats on both dashboard and requests section
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
        setCount('requestsAllCountMenu', requests.length);
        setCount('requestsPendingCountMenu', pending);
        setCount('requestsApprovedCountMenu', approved);
        setCount('requestsClarificationCountMenu', clarification);
        setCount('requestsRejectedCountMenu', rejected);
        setCount('requestsFulfilledCountMenu', fulfilled);

        // Sync trigger button text with the currently active filter item
        const activeItem = document.querySelector('.filter-item.active');
        const triggerText = document.getElementById('selectedFilterText');
        if (activeItem && triggerText) {
          triggerText.textContent = activeItem.textContent;
        }

        const badge = document.getElementById('requestBadge');
        if (badge) badge.textContent = requests.length;

        // Full list in My Requests section (filtered)
        applyRequestFilter();

        // Recent 3 on dashboard
        dashList.innerHTML = requests.slice(0, 3).map(renderRequestCard).join('');
      } catch (err) {
        console.error('Failed to load requests:', err);
        const readable = err?.message ? `Failed to load requests: ${err.message}` : 'Failed to load requests. Please try again.';
        document.getElementById('requestList').innerHTML =
          `<p style="text-align:center;color:var(--accent);padding:24px 0;">${readable}</p>`;
        document.getElementById('dashboardRequestList').innerHTML =
          `<p style="text-align:center;color:var(--accent);padding:24px 0;">${readable}</p>`;
      }
    }

    // Filter dropdown toggle and option selection
    const filterDropdown = document.getElementById('filterDropdown');
    const filterTrigger = document.getElementById('filterTrigger');

    filterTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isOpen = filterDropdown.classList.contains('open');
      filterDropdown.classList.toggle('open', !isOpen);
      filterTrigger.setAttribute('aria-expanded', !isOpen);
    });

    document.addEventListener('click', (e) => {
      if (filterDropdown && !filterDropdown.contains(e.target)) {
        filterDropdown.classList.remove('open');
        filterTrigger.setAttribute('aria-expanded', 'false');
      }
    });

    document.querySelectorAll('.filter-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-item').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        
        activeRequestFilter = btn.getAttribute('data-request-filter') || 'all';
        applyRequestFilter();

        // Sync trigger text
        document.getElementById('selectedFilterText').innerHTML = btn.innerHTML;

        filterDropdown.classList.remove('open');
        filterTrigger.setAttribute('aria-expanded', 'false');
      });
    });

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
        const { error } = await createBloodRequest(body);

        if (error) {
          msg.textContent = error.message || 'Failed to submit request.';
          msg.className = 'form-msg error';
          return;
        }

        msg.textContent = 'Blood request submitted successfully!';
        msg.className = 'form-msg success';
        loadRequests();
        setTimeout(closeRequestModal, 1200);
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
      if (event) event.stopPropagation();
      const dropdown = document.getElementById('headerProfileDropdown');
      if (dropdown) dropdown.classList.remove('active');
      closeNotificationPanel();
      setSidebarOpen(false);
      document.body.classList.add('modal-open');
      document.getElementById('logoutConfirmModal').classList.add('active');
    }

    function closeLogoutModal() {
      document.getElementById('logoutConfirmModal').classList.remove('active');
      document.body.classList.remove('modal-open');
    }

    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');
    if (confirmLogoutBtn) {
      confirmLogoutBtn.addEventListener('click', async () => {
        confirmLogoutBtn.disabled = true;
        confirmLogoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Logging out...';
        if (typeof signOut === 'function') {
          await signOut();
        } else {
          document.body.classList.remove('modal-open');
          window.location.href = 'login.html';
        }
      });
    }

    // Update the sidebar logout to also show confirmation
    const sidebarLogoutBtn = document.getElementById('logoutBtn');
    if (sidebarLogoutBtn) {
      sidebarLogoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        openLogoutModal();
      });
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
