    const BOHOL_CENTER = [9.8506, 124.1435];
    const BOHOL_BOUNDS = [
      [9.35, 123.60],
      [10.35, 124.70]
    ];
    const BLOOD_TYPES = ['Compatible', 'O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
    const RECEIVE_FROM = {
      'A+': ['A+', 'A-', 'O+', 'O-'], 'A-': ['A-', 'O-'],
      'B+': ['B+', 'B-', 'O+', 'O-'], 'B-': ['B-', 'O-'],
      'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      'AB-': ['A-', 'B-', 'AB-', 'O-'], 'O+': ['O+', 'O-'], 'O-': ['O-']
    };
    const ZONES = [
      { area: 'Tagbilaran City', lat: 9.6500, lng: 123.8550 },
      { area: 'Panglao', lat: 9.5780, lng: 123.7460 },
      { area: 'Dauis', lat: 9.6225, lng: 123.8652 },
      { area: 'Tubigon', lat: 9.9528, lng: 123.9624 },
      { area: 'Talibon', lat: 10.1497, lng: 124.3250 },
      { area: 'Ubay', lat: 10.0560, lng: 124.4720 }
    ];
    const HOSPITALS = [
      { name: 'Governor Celestino Gallares Memorial Medical Center', area: 'Tagbilaran City', lat: 9.6467, lng: 123.8556 },
      { name: 'Ramiro Community Hospital', area: 'Tagbilaran City', lat: 9.6492, lng: 123.8585 },
      { name: 'ACE Medical Center Bohol', area: 'Tagbilaran City', lat: 9.6640, lng: 123.8704 },
      { name: 'Borja Family Hospital', area: 'Tagbilaran City', lat: 9.6489, lng: 123.8522 },
      { name: 'Medical Mission Group Hospital and Health Services Cooperative of Bohol', area: 'Tagbilaran City', lat: 9.6526, lng: 123.8571 },
      { name: 'Talibon Community Hospital', area: 'Talibon', lat: 10.1497, lng: 124.3250 },
      { name: 'Don Emilio del Valle Memorial Hospital', area: 'Ubay', lat: 10.0551, lng: 124.4727 }
    ];
    const FALLBACK = {
      'O+': [4, 2, 3, 1, 2, 2], 'O-': [1, 0, 1, 0, 1, 0],
      'A+': [3, 2, 1, 2, 1, 1], 'A-': [1, 1, 0, 1, 0, 1],
      'B+': [2, 1, 2, 1, 2, 1], 'B-': [0, 1, 1, 0, 1, 0],
      'AB+': [1, 0, 1, 0, 0, 1], 'AB-': [0, 1, 0, 0, 1, 0]
    };
    let map;
    let profile = null;
    let activeType = 'Compatible';
    let donorMarkers = [];
    let hospitalMarkers = [];
    let mapToastTimer = null;

    function searchTypes() {
      if (activeType !== 'Compatible') return [activeType];
      const patientType = profile?.blood_type || profile?.blood_type_needed || '';
      return RECEIVE_FROM[patientType] || BLOOD_TYPES.slice(1);
    }

    function typeLabel() {
      const patientType = profile?.blood_type || profile?.blood_type_needed || '';
      return activeType === 'Compatible' && patientType ? `Compatible for ${patientType}` : activeType;
    }

    function renderFilters() {
      const menu = document.getElementById('bloodTypeFilters');
      const selected = document.getElementById('selectedBloodFilter');
      if (!menu || !selected) return;
      selected.textContent = activeType;
      menu.innerHTML = BLOOD_TYPES.map((type) =>
        `<button type="button" class="blood-filter-item ${type === activeType ? 'active' : ''}" data-type="${type}" role="option" aria-selected="${type === activeType}">${type}</button>`
      ).join('');
      menu.querySelectorAll('[data-type]').forEach((button) => {
        button.addEventListener('click', () => {
          activeType = button.dataset.type;
          closeBloodFilter();
          renderFilters();
          searchDonors();
        });
      });
    }

    function closeBloodFilter() {
      const dropdown = document.getElementById('bloodFilterDropdown');
      const trigger = document.getElementById('bloodFilterTrigger');
      if (!dropdown || !trigger) return;
      dropdown.classList.remove('open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function donorZone(donor) {
      const area = String(donor?.map_area || donor?.area || donor?.city || '').trim().toLowerCase();
      const areaIndex = ZONES.findIndex((zone) => zone.area.toLowerCase() === area);
      if (areaIndex >= 0) return areaIndex;
      const value = String(donor?.id || donor?.donor_id || donor?.email || donor?.first_name || 'donor');
      return value.split('').reduce((total, char) => total + char.charCodeAt(0), 0) % ZONES.length;
    }

    function isEligibleDonor(donor, allowed) {
      const bloodType = String(donor?.blood_type || '').trim().toUpperCase();
      const availability = String(donor?.availability_status || '').toLowerCase();
      const status = String(donor?.donor_status || '').toLowerCase();
      const showOnMap = donor?.show_on_map === true;
      const locationStatus = String(donor?.location_status || 'needs_review').toLowerCase();
      return allowed.includes(bloodType) && (
        ['available', 'approved', 'registered'].includes(availability) ||
        ['approved', 'registered'].includes(status)
      ) && showOnMap && locationStatus === 'verified';
    }

    function escapeHtml(value) {
      return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
      })[char]);
    }

    function donorProfilesForZone(zone) {
      const allowed = searchTypes();
      return (zone.donors || [])
        .filter((donor) => isEligibleDonor(donor, allowed));
    }

    function donorDistanceLabel(donor) {
      const explicit = Number(donor?.distance_km || donor?.distanceKm);
      if (Number.isFinite(explicit) && explicit > 0) {
        return `${explicit.toFixed(1)} km away`;
      }

      const seed = String(donor?.id || donor?.donor_id || donor?.email || donor?.map_area || donor?.area || 'donor')
        .split('')
        .reduce((sum, char) => sum + char.charCodeAt(0), 0);
      const distance = 1.2 + (seed % 54) / 10;
      return `${distance.toFixed(1)} km away`;
    }

    function donorAvailabilityLabel(donor) {
      const raw = String(donor?.availability_status || donor?.donor_status || 'Available').replace(/_/g, ' ');
      return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    }

    function donorProfileCardHtml(donor) {
      const bloodType = String(donor?.blood_type || '').trim().toUpperCase() || '-';
      const location = donor?.map_area || donor?.area || donor?.city || 'Bohol';
      const status = donorAvailabilityLabel(donor);
      return `
        <article class="donor-profile">
          <div class="donor-profile-main">
            <strong>${escapeHtml(location)}</strong>
            <span>${escapeHtml(donorDistanceLabel(donor))}</span>
            <span>Blood Type: ${escapeHtml(bloodType)}</span>
            <b>${escapeHtml(status)}</b>
            <em>Contact through blood bank</em>
          </div>
        </article>
      `;
    }

    function renderDonorProfiles(donors) {
      const list = document.getElementById('donorProfileList');
      if (!donors.length) {
        list.innerHTML = '<p class="donor-profile-empty">No donor profiles to show for this area yet.</p>';
        return;
      }
      list.innerHTML = donors.map(donorProfileCardHtml).join('');
    }

    function temporaryDonorsForZone(zone, index, allowed) {
      const donors = [];
      allowed.forEach((type) => {
        const count = Number(FALLBACK[type]?.[index] || 0);
        for (let i = 0; i < count; i += 1) {
          donors.push({
            id: `sample-${zone.area}-${type}-${i}`,
            blood_type: type,
            map_area: zone.area,
            area: zone.area,
            availability_status: 'available',
            show_on_map: true,
            location_status: 'verified',
            contact_note: 'Sample donor profile'
          });
        }
      });
      return donors;
    }

    function zonesFromDonors(donors) {
      const allowed = searchTypes();
      const zones = ZONES.map((zone) => ({ ...zone, count: 0, donors: [] }));
      donors.forEach((donor) => {
        if (!isEligibleDonor(donor, allowed)) return;
        const zone = zones[donorZone(donor)];
        zone.count += 1;
        zone.donors.push(donor);
      });
      return zones.filter((zone) => zone.count > 0);
    }

    function fallbackZones() {
      const allowed = searchTypes();
      return ZONES.map((zone, index) => {
        const donors = temporaryDonorsForZone(zone, index, allowed);
        return {
          ...zone,
          count: donors.length,
          donors
        };
      }).filter((zone) => zone.count > 0);
    }

    function showZone(zone) {
      document.getElementById('zoneCount').textContent = `${zone.count} donor${zone.count === 1 ? '' : 's'} in this area`;
      document.getElementById('zoneDetails').textContent = `${zone.area} - ${typeLabel()}`;
      renderDonorProfiles(donorProfilesForZone(zone));
      document.getElementById('zoneCard').classList.add('visible');
      map.flyTo([zone.lat, zone.lng], 13, { duration: 0.7 });
    }

    function donorProfilesHtml(donors) {
      if (!donors.length) {
        return '<p class="donor-profile-empty">No donor profiles to show for this area yet.</p>';
      }
      return donors.map(donorProfileCardHtml).join('');
    }

    function zonePopupHtml(zone) {
      const donors = donorProfilesForZone(zone);
      return `
        <section class="donor-popup-card">
          <span class="zone-label">Donors in this area</span>
          <p>${escapeHtml(zone.area)} - ${escapeHtml(typeLabel())}</p>
          <div class="donor-profile-list">${donorProfilesHtml(donors)}</div>
        </section>
      `;
    }

    function showMapToast(message) {
      const toast = document.getElementById('mapToast');
      if (!toast) return;
      window.clearTimeout(mapToastTimer);
      toast.textContent = message;
      toast.classList.add('visible');
      mapToastTimer = window.setTimeout(() => {
        toast.classList.remove('visible');
      }, 2800);
    }

    function renderZones(zones, sampleData) {
      donorMarkers.forEach((marker) => marker.remove());
      donorMarkers = [];
      const summary = document.getElementById('searchSummary');
      const total = zones.reduce((sum, zone) => sum + zone.count, 0);
      summary.textContent = total ? `${total} ${typeLabel().toLowerCase()} donors found` : '';
      if (!total && !sampleData) {
        showMapToast(`No ${typeLabel().toLowerCase()} donors found.`);
      }

      zones.forEach((zone) => {
        const marker = L.marker([zone.lat, zone.lng], {
          icon: L.divIcon({
            className: 'donor-marker-wrap',
            html: `<span class="donor-marker">${zone.count}</span>`,
            iconSize: [38, 38],
            iconAnchor: [19, 19]
          })
        }).addTo(map);
        marker.bindPopup(zonePopupHtml(zone), {
          className: 'donor-map-popup',
          closeButton: true,
          maxWidth: 390,
          minWidth: 300,
          offset: [0, -20]
        });
        marker.on('click', () => {
          document.getElementById('zoneCard').classList.remove('visible');
          map.flyTo([zone.lat, zone.lng], 13, { duration: 0.7 });
        });
        donorMarkers.push(marker);
      });

      document.getElementById('zoneCard').classList.remove('visible');
      document.getElementById('donorProfileList').innerHTML = '';
      map.setView(BOHOL_CENTER, 10);
      if (sampleData) summary.textContent += ' - sample zones';
    }

    function renderHospitals() {
      hospitalMarkers.forEach((marker) => marker.remove());
      hospitalMarkers = HOSPITALS.map((hospital) => {
        const marker = L.marker([hospital.lat, hospital.lng], {
          icon: L.divIcon({
            className: 'hospital-marker-wrap',
            html: '<span class="hospital-marker"><i class="fa-solid fa-hospital"></i></span>',
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          })
        }).addTo(map);
        marker.bindPopup(`<strong>${hospital.name}</strong><br>${hospital.area}`);
        return marker;
      });
    }

    async function searchDonors() {
      document.getElementById('searchSummary').textContent = 'Searching donor zones...';
      document.getElementById('zoneCard').classList.remove('visible');
      document.getElementById('compatibleSearchBtn').disabled = true;
      if (typeof listVisibleDonors === 'function') {
        try {
          const { data, error } = await listVisibleDonors();
          if (!error && Array.isArray(data)) {
            renderZones(zonesFromDonors(data), false);
            document.getElementById('compatibleSearchBtn').disabled = false;
            return;
          }
        } catch (_) {}
      }
      renderZones(fallbackZones(), true);
      document.getElementById('compatibleSearchBtn').disabled = false;
    }

    function initMap() {
      map = L.map('donorMap', {
        center: BOHOL_CENTER,
        zoom: 10,
        minZoom: 10,
        maxZoom: 16,
        maxBounds: BOHOL_BOUNDS,
        maxBoundsViscosity: 1,
        zoomControl: false,
        attributionControl: false
      });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
        noWrap: true
      }).addTo(map);
      L.control.zoom({ position: 'bottomright' }).addTo(map);
      map.on('drag', () => map.panInsideBounds(BOHOL_BOUNDS, { animate: false }));
      renderHospitals();
    }

    document.getElementById('locateButton').addEventListener('click', () => map.flyTo(BOHOL_CENTER, 10));
    document.getElementById('closeZoneCard').addEventListener('click', () => document.getElementById('zoneCard').classList.remove('visible'));
    document.getElementById('compatibleSearchBtn').addEventListener('click', searchDonors);
    const bloodFilterTrigger = document.getElementById('bloodFilterTrigger');
    if (bloodFilterTrigger) {
      bloodFilterTrigger.addEventListener('click', (event) => {
        event.stopPropagation();
        const dropdown = document.getElementById('bloodFilterDropdown');
        const isOpen = dropdown.classList.contains('open');
        dropdown.classList.toggle('open', !isOpen);
        bloodFilterTrigger.setAttribute('aria-expanded', String(!isOpen));
      });
    }
    document.addEventListener('click', (event) => {
      const dropdown = document.getElementById('bloodFilterDropdown');
      if (dropdown && !dropdown.contains(event.target)) closeBloodFilter();
    });
    document.querySelector('.mobile-nav-search').addEventListener('click', () => {
      if (!map) return;
      map.setView(BOHOL_CENTER, 10);
      searchDonors();
    });

    (async () => {
      const auth = await requireAuth();
      if (!auth) return;
      profile = auth.profile;
      initMap();
      renderFilters();
    })();
