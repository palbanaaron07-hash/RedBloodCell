import { useMemo, useState } from 'react';
import logoMark from '../assets/veindrop-mark.svg';

const bloodTypes = ['All', 'O+', 'A-', 'B+', 'AB+', 'O-'];
const publicDonorLoginHref = `login.html?fresh=1&next=${encodeURIComponent('donor_registration.html?return=patient_dashboard.html%23section-donor')}`;

const donorZones = [
  { id: 1, area: 'North District', bloodType: 'O+', count: 4, x: 25, y: 36, radius: '3 km', eta: '12 min' },
  { id: 2, area: 'City Center', bloodType: 'A-', count: 2, x: 58, y: 32, radius: '5 km', eta: '18 min' },
  { id: 3, area: 'South Clinic Area', bloodType: 'B+', count: 3, x: 72, y: 62, radius: '4 km', eta: '21 min' },
  { id: 4, area: 'West Station', bloodType: 'AB+', count: 1, x: 38, y: 68, radius: '6 km', eta: '27 min' },
  { id: 5, area: 'East Hospital Belt', bloodType: 'O-', count: 2, x: 80, y: 43, radius: '4 km', eta: '16 min' }
];

const inventory = [
  { type: 'O+', units: 18, level: 'Good' },
  { type: 'A-', units: 6, level: 'Low' },
  { type: 'B+', units: 11, level: 'Stable' },
  { type: 'AB+', units: 4, level: 'Critical' }
];

const activity = [
  { icon: 'fa-solid fa-triangle-exclamation', title: 'Urgent request opened', meta: 'O- needed near East Hospital Belt' },
  { icon: 'fa-solid fa-message', title: 'Chat awaiting donor consent', meta: 'Contact stays hidden until accepted' },
  { icon: 'fa-solid fa-shield-halved', title: 'Location privacy active', meta: 'Showing approximate zones only' }
];

function BrandIcon({ small = false }) {
  return (
    <div className={`brand-icon${small ? ' brand-icon-sm' : ''}`} aria-hidden="true">
      <img src={logoMark} alt="" />
    </div>
  );
}

function App() {
  const [leavingHref, setLeavingHref] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  const visibleZones = useMemo(
    () => donorZones.filter((zone) => selectedType === 'All' || zone.bloodType === selectedType),
    [selectedType]
  );

  const navigateWithTransition = (event, href) => {
    event.preventDefault();
    setLeavingHref(href);
    window.setTimeout(() => {
      window.location.href = href;
    }, 260);
  };

  return (
    <div className={leavingHref ? 'page-leave app-shell pwa-redesign' : 'app-shell pwa-redesign'}>
      <Header onNavigate={navigateWithTransition} />
      <main className="pwa-main">
        <DashboardHero onNavigate={navigateWithTransition} />
        <section className="dashboard-grid" aria-label="VeinDrop dashboard">
          <DonorMap selectedType={selectedType} setSelectedType={setSelectedType} visibleZones={visibleZones} />
          <RequestPanel onNavigate={navigateWithTransition} />
          <InventoryPanel />
          <ChatPanel />
          <PrivacyPanel />
          <ActivityPanel />
        </section>
      </main>
      <MobileNav onNavigate={navigateWithTransition} />
    </div>
  );
}

function Header({ onNavigate }) {
  return (
    <header className="app-topbar">
      <a className="app-brand" href="/" aria-label="VeinDrop home">
        <BrandIcon />
        <span>VeinDrop</span>
      </a>

      <nav className="app-nav" aria-label="Primary">
        <a href="#match">Map</a>
        <a href="#request">Request</a>
        <a href="#chat">Chat</a>
        <a href="#privacy">Privacy</a>
      </nav>

      <div className="app-actions">
        <a className="icon-btn" href="login.html" onClick={(event) => onNavigate(event, 'login.html')} aria-label="Login">
          <i className="fa-regular fa-user" aria-hidden="true"></i>
        </a>
        <a className="primary-action" href="register.html" onClick={(event) => onNavigate(event, 'register.html')}>
          Register
        </a>
      </div>
    </header>
  );
}

function DashboardHero({ onNavigate }) {
  return (
    <section className="dashboard-hero">
      <div>
        <p className="status-pill">
          <span></span>
          Emergency network online
        </p>
        <h1>Blood requests, donor matching, and safe chat in one PWA.</h1>
        <p className="hero-copy">
          VeinDrop helps patients and hospitals find compatible donors while protecting exact location and contact details.
        </p>
      </div>

      <div className="hero-command">
        <a className="command-card urgent" href="patient_dashboard.html" onClick={(event) => onNavigate(event, 'patient_dashboard.html')}>
          <i className="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
          <span>Request blood</span>
          <strong>Start urgent workflow</strong>
        </a>
        <a className="command-card donor" href={publicDonorLoginHref} onClick={(event) => onNavigate(event, publicDonorLoginHref)}>
          <i className="fa-solid fa-heart-pulse" aria-hidden="true"></i>
          <span>Become a donor</span>
          <strong>Share availability safely</strong>
        </a>
      </div>
    </section>
  );
}

function DonorMap({ selectedType, setSelectedType, visibleZones }) {
  return (
    <section className="panel map-panel" id="match">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Approximate matching</p>
          <h2>Donor map</h2>
        </div>
        <span className="secure-chip">
          <i className="fa-solid fa-lock" aria-hidden="true"></i>
          private
        </span>
      </div>

      <div className="type-tabs" aria-label="Filter donor zones by blood type">
        {bloodTypes.map((type) => (
          <button className={selectedType === type ? 'active' : ''} type="button" key={type} onClick={() => setSelectedType(type)}>
            {type}
          </button>
        ))}
      </div>

      <div className="app-map" aria-label="Approximate donor availability map">
        <div className="map-road horizontal"></div>
        <div className="map-road vertical"></div>
        <div className="map-road diagonal"></div>
        {visibleZones.map((zone) => (
          <button
            className="zone-marker"
            type="button"
            key={zone.id}
            style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
            title={`${zone.count} ${zone.bloodType} donors in ${zone.area}`}
          >
            <span>{zone.count}</span>
          </button>
        ))}
      </div>

      <div className="zone-list">
        {visibleZones.map((zone) => (
          <article key={zone.id}>
            <strong>{zone.area}</strong>
            <span>{zone.count} {zone.bloodType} donors within {zone.radius}</span>
            <small>{zone.eta}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function RequestPanel({ onNavigate }) {
  return (
    <section className="panel request-panel" id="request">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Fast intake</p>
          <h2>Emergency request</h2>
        </div>
        <i className="fa-solid fa-bolt" aria-hidden="true"></i>
      </div>
      <div className="request-summary">
        <div>
          <span>Needed blood</span>
          <strong>O-</strong>
        </div>
        <div>
          <span>Priority</span>
          <strong>High</strong>
        </div>
      </div>
      <p>Patients submit a request first. Donors only receive the safe summary and can accept chat before any direct contact is shared.</p>
      <a className="full-action" href="patient_dashboard.html" onClick={(event) => onNavigate(event, 'patient_dashboard.html')}>
        Open request form
        <i className="fa-solid fa-arrow-right" aria-hidden="true"></i>
      </a>
    </section>
  );
}

function InventoryPanel() {
  return (
    <section className="panel inventory-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Stock watch</p>
          <h2>Inventory</h2>
        </div>
      </div>
      <div className="inventory-list">
        {inventory.map((item) => (
          <article key={item.type}>
            <strong>{item.type}</strong>
            <div className="stock-bar" aria-hidden="true">
              <span style={{ width: `${Math.min(item.units * 5, 100)}%` }}></span>
            </div>
            <span>{item.units} units</span>
            <small className={item.level.toLowerCase()}>{item.level}</small>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChatPanel() {
  return (
    <section className="panel chat-panel" id="chat">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Consent-based</p>
          <h2>Chat preview</h2>
        </div>
        <i className="fa-solid fa-comments" aria-hidden="true"></i>
      </div>
      <div className="chat-thread">
        <p className="message system">A recipient near your area needs O+ blood. Exact location hidden.</p>
        <p className="message donor">I can help. Share hospital details after approval.</p>
        <p className="message system">Chat accepted. Contact reveal requires confirmation.</p>
      </div>
    </section>
  );
}

function PrivacyPanel() {
  return (
    <section className="panel privacy-panel" id="privacy">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Safety rules</p>
          <h2>Donor privacy</h2>
        </div>
        <i className="fa-solid fa-shield-halved" aria-hidden="true"></i>
      </div>
      <ul className="privacy-checks">
        <li>Show grouped zones instead of exact home pins.</li>
        <li>Hide phone, email, and address until donor approval.</li>
        <li>Log admin access to sensitive donor records.</li>
        <li>Let donors pause availability anytime.</li>
      </ul>
    </section>
  );
}

function ActivityPanel() {
  return (
    <section className="panel activity-panel">
      <div className="panel-heading">
        <div>
          <p className="panel-kicker">Today</p>
          <h2>Live activity</h2>
        </div>
      </div>
      <div className="activity-list">
        {activity.map((item) => (
          <article key={item.title}>
            <i className={item.icon} aria-hidden="true"></i>
            <div>
              <strong>{item.title}</strong>
              <span>{item.meta}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function MobileNav({ onNavigate }) {
  return (
    <nav className="mobile-nav" aria-label="Mobile">
      <a href="#match">
        <i className="fa-solid fa-map-location-dot" aria-hidden="true"></i>
        Map
      </a>
      <a href="patient_dashboard.html" onClick={(event) => onNavigate(event, 'patient_dashboard.html')}>
        <i className="fa-solid fa-droplet" aria-hidden="true"></i>
        Request
      </a>
      <a href="#chat">
        <i className="fa-solid fa-message" aria-hidden="true"></i>
        Chat
      </a>
      <a href="login.html" onClick={(event) => onNavigate(event, 'login.html')}>
        <i className="fa-regular fa-user" aria-hidden="true"></i>
        Login
      </a>
    </nav>
  );
}

export default App;

