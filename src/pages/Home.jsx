import GlobeComponent from '../components/Globe.jsx'
import PinPanel from '../components/PinPanel.jsx'
import './Home.css'

export default function Home({ pinMode, pin, onPinPlaced, onPinClose }) {
  return (
    <main className="home">
      <GlobeComponent pinMode={pinMode} pin={pin} onPinPlaced={onPinPlaced} />
      <PinPanel pin={pin} onClose={onPinClose} />
      <section id="globe-section" className="home-section home-section--globe">
        <div className="section-inner">
          <p className="section-label mono">Interactive Globe</p>
          <h1 className="home-headline">
            Voices that travel.<br />
            <em>Identities that stay.</em>
          </h1>
          <p className="home-subhead">
            A satellite-aware archive of oral traditions from the world's most isolated communities.
          </p>
        </div>
      </section>

      <section id="how-it-works" className="home-section home-section--how">
        <div className="section-inner">
          <p className="section-label mono">How It Works</p>
          <h2>Three steps to preserve a voice</h2>
        </div>
      </section>

      <section id="record-section" className="home-section home-section--record">
        <div className="section-inner">
          <p className="section-label mono">Record</p>
          <h2>Add your echo to the archive</h2>
        </div>
      </section>

      <section id="latest-echoes" className="home-section home-section--latest">
        <div className="section-inner">
          <p className="section-label mono">Latest Echoes</p>
          <h2>Recently archived voices</h2>
        </div>
      </section>
    </main>
  )
}
