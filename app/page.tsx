'use client';

import { FormEvent, useState } from 'react';
import { Check, ChevronRight, MapPin, ShieldCheck, Truck } from 'lucide-react';

const cities = ['Tallahassee', 'Monticello', 'Live Oak', 'Lake City', 'Perry', 'Madison'];
const combos = [
  { code:'CD-PARRILLERO', number:'01', name:'Parrillero', weight:'18.2 lb', price:200, imagePosition:'center', cuts:['Churrasco','Tomahawk','Cowboy Steak','New York Steak','Chorizo Argentino o Salchicha Parrillera','Regalo a escoger: Chicharrón o Manteca de Cerdo'] },
  { code:'CD-FAMILIAR', number:'02', name:'Familiar', weight:'16 lb', price:176, imagePosition:'42% center', cuts:['Chuck Roll Steak','Short Ribs','Petite Tender','New York Steak','Picanha','Chorizo Argentino','Salchicha Parrillera','Lomo Ahumado'] },
  { code:'CD-PREMIUM', number:'03', name:'Premium', weight:'22 lb', price:242, imagePosition:'72% center', cuts:['Tomahawk','Churrasco / Outside Skirt','Ribeye','Flap Meat','Porterhouse','T-Bone','New York Steak','Short Ribs','Picanha','Cowboy Steak','Chorizo Argentino'] },
];
const cuts = [
  { name: 'Tomahawk', image: '/products/tomahawk.png' },
  { name: 'Churrasco / Outside Skirt Steak', image: '/products/churrasco.png' },
  { name: 'Ribeye', image: null },
  { name: 'Flap Meat', image: null },
  { name: 'Porterhouse', image: null },
  { name: 'T-Bone', image: null },
  { name: 'Chuck Roll Steak', image: null },
  { name: 'Oxtail / Rabo', image: null },
  { name: 'New York Steak', image: '/products/new-york.png' },
  { name: 'Short Ribs', image: null },
  { name: 'Petite Tender', image: null },
  { name: 'Picanha', image: null },
  { name: 'Cowboy Steak', image: '/products/cowboy.png' },
  { name: 'Lomo Ahumado', image: null },
  { name: 'Salchicha Parrillera', image: null },
  { name: 'Chorizo Argentino', image: null },
  { name: 'Chicharrón', image: null },
  { name: 'Manteca de Cerdo', image: null },
];
export default function Home() {
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedCombo, setSelectedCombo] = useState('CD-PARRILLERO');

  function scrollToSection(id: 'combos' | 'cortes' | 'preorden') {
    const section = document.getElementById(id);
    if (!section) return;
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    window.history.replaceState(null, '', `#${id}`);
  }

  async function submitPreorder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement=event.currentTarget;const form=new FormData(formElement);setSubmitting(true);setSuccess(false);setError('');
    try{const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotencyKey:crypto.randomUUID(),name:form.get('name'),phone:form.get('phone'),city:form.get('city'),zip:form.get('zip'),address:form.get('address'),quantity:form.get('quantity'),combo:form.get('combo'),chorizo:form.get('chorizo')||undefined,gift:form.get('gift')||undefined,paymentMethod:form.get('paymentMethod')})});const result=await response.json() as {error?:string;order?:{order_number:string}};if(!response.ok||!result.order)throw new Error(result.error||'No pudimos guardar la orden.');setOrderNumber(result.order.order_number);setSuccess(true);formElement.reset();setSelectedCombo('CD-PARRILLERO')}catch(submissionError){setError(submissionError instanceof Error?submissionError.message:'No pudimos guardar la orden.')}finally{setSubmitting(false)}
  }

  return <main>
    <section className="hero">
      <img className="hero-image" src="/combos-hero.png" alt="Paquetes de carne reales incluidos en la oferta" />
      <div className="hero-shade" />
      <nav className="nav-shell" aria-label="Navegación principal">
        <a className="brand" href="#inicio"><span className="brand-mark">CD</span><span>Corte Directo <small>by Mi Casita</small></span></a>
        <a className="nav-link" href="#preorden">Reservar <ChevronRight size={16} /></a>
      </nav>
      <div id="inicio" className="hero-copy">
        <p className="kicker">Combos de carne premium disponibles</p>
        <h1>La carne que necesitas, directo a tu casa.</h1>
        <p className="hero-lead">Cortes seleccionados, empacados y listos para que armes tu parrillada o comida familiar.</p>
        <div className="hero-actions">
          <a className="primary-button" href="#combos" onClick={(event) => { event.preventDefault(); scrollToSection('combos'); }}>Ver combos <ChevronRight size={18} /></a>
          <button className="outline-button" type="button" onClick={() => scrollToSection('cortes')}>Ver cortes</button>
          <button className="text-button" type="button" onClick={() => scrollToSection('preorden')}>Reservar / Preordenar</button>
        </div>
        <div className="delivery-block"><Truck size={24} /><div><strong>Entrega directa hasta tu casa</strong><span>Perry · Madison · Tallahassee · Monticello · Live Oak · Lake City</span></div></div>
      </div>
    </section>

    <section className="trust-section"><div className="section-shell trust-layout">
      <img src="/products/churrasco.png" alt="Empaque real del productor visible en las fotografías proporcionadas" />
      <div><p className="kicker dark">Confianza y transparencia</p><h2>Conoce la carne que estás comprando</h2>
        <p className="producer-name">Carnes San Martín Gold</p>
        <p>Marca visible en los empaques reales proporcionados. Los productos se muestran empacados y sellados en la fotografía original.</p>
        <small>El país de origen y otras certificaciones no se muestran porque no están confirmados.</small>
      </div>
    </div></section>

    <section id="cortes" className="cuts-section">
      <div className="section-shell">
        <div className="section-heading"><div><p className="kicker dark">Nuestros cortes</p><h2>Opciones para cada mesa.</h2></div><p>Explora los tipos de cortes disponibles. Cuando no existe una foto real exacta en los archivos proporcionados, la imagen queda pendiente.</p></div>
        <div className="cuts-grid">{cuts.map(cut => <article className="cut-card" key={cut.name}>
          {cut.image ? <img src={cut.image} alt={`Fotografía real disponible de ${cut.name}`} /> : <div className="cut-photo-pending">Foto pendiente</div>}
          <h3>{cut.name}</h3>
        </article>)}</div>
      </div>
    </section>

    <section className="contents section-shell">
      <div id="combos" className="combo-target">
      <div className="combo-section-header"><div><p className="kicker dark">Nuestros Combos</p><h2>Tres opciones para compartir.</h2></div><p>Cada tarjeta muestra peso y precio total. Selecciona la opción que mejor se adapte a tu mesa.</p></div>
      <div className="combo-index" aria-label="Combos disponibles">{combos.map(combo => <div key={combo.code}><span>Combo #{combo.number}</span><strong>{combo.name}</strong></div>)}</div>
      <div className="combo-cards">{combos.map(combo => <article className="offer-card" key={combo.code}>
        <img src="/combos-hero.png" alt={`Paquetes reales para presentar el combo ${combo.name}`} style={{objectPosition:combo.imagePosition}} />
        <div className="offer-body"><p className="offer-label">Combo #{combo.number}</p><h3>{combo.name}</h3>
          <div className="offer-meta"><span>{combo.weight}</span><strong>${combo.price}</strong></div>
          <ul>{combo.cuts.map(cut => <li key={cut}>{cut}</li>)}</ul>
          <button type="button" onClick={() => { setSelectedCombo(combo.code); document.querySelector('#preorden')?.scrollIntoView({behavior:'smooth'}); }}>Reservar este combo <ChevronRight size={17}/></button>
        </div>
      </article>)}</div>
      <div className="benefit-band"><div><span>Para compartir</span><strong>Ideal para aproximadamente 10 personas</strong></div><div><span>Más comodidad</span><strong>Entrega hasta la puerta de tu casa</strong></div></div>
      </div>
    </section>

    <section id="preorden" className="form-section"><div className="section-shell form-layout">
      <div className="form-context"><p className="kicker">Reserva tu combo hoy</p><h2>Déjanos tus datos.</h2>
        <p>Te contactaremos para confirmar disponibilidad y coordinar la entrega. Registrar tu interés no genera un cobro ni confirma inventario.</p>
        <div className="selected-card"><span>Combo seleccionado</span><strong>{combos.find(combo => combo.code === selectedCombo)?.name}</strong></div>
        <div className="city-list"><MapPin size={19} /> {cities.join(' · ')}</div>
        <div className="status-note"><Check size={18} /> Tu orden se guardará de forma segura para que podamos darle seguimiento.</div>
      </div>
      <form className="preorder-form" onSubmit={submitPreorder}><div className="field-grid">
        <label>Nombre completo<input name="name" autoComplete="name" required placeholder="Tu nombre" /></label>
        <label>Teléfono<input name="phone" type="tel" autoComplete="tel" required placeholder="(850) 000-0000" /></label>
        <label>Ciudad<select name="city" required defaultValue=""><option value="" disabled>Selecciona tu ciudad</option>{cities.map(city => <option key={city}>{city}</option>)}</select></label>
        <label>ZIP<input name="zip" inputMode="numeric" autoComplete="postal-code" required pattern="[0-9]{5}" maxLength={5} placeholder="32301" /></label>
        <label className="wide-field">Dirección de entrega<input name="address" autoComplete="street-address" required minLength={5} maxLength={180} placeholder="Calle, número y apartamento" /></label>
        <label>Combo<select name="combo" required value={selectedCombo} onChange={event => setSelectedCombo(event.target.value)}>{combos.map(combo => <option key={combo.code} value={combo.code}>{combo.name} · {combo.weight}</option>)}</select></label>
        <label>Cantidad<input name="quantity" type="number" min="1" max="20" defaultValue="1" required /></label>
        <label className="wide-field">Método de pago<select name="paymentMethod" defaultValue="cash_on_delivery" required><option value="cash_on_delivery">Cash on Delivery</option><option value="card_stripe" disabled>Card / Stripe — próximamente</option></select></label>
        {selectedCombo === 'CD-PARRILLERO' && <><label>Chorizo<select name="chorizo" required defaultValue=""><option value="" disabled>Escoge una opción</option><option>Chorizo Argentino</option><option>Salchicha Parrillera</option></select></label>
        <label className="wide-field">Regalo<select name="gift" required defaultValue=""><option value="" disabled>Escoge tu regalo</option><option>Chicharrón</option><option>Manteca de Cerdo</option></select></label></>}
      </div>
        <label className="consent"><input type="checkbox" required /> Autorizo a Corte Directo by Mi Casita a usar estos datos para contactarme sobre esta preorden.</label>
        <button className="submit-button" type="submit" disabled={submitting}>{submitting?'Guardando orden…':'Reservar mi combo'} <ChevronRight size={18} /></button>
        <p className="form-disclaimer"><ShieldCheck size={14}/> Cash on Delivery · No se realizará ningún cobro en línea</p>
        {error && <output className="form-error" aria-live="polite">{error}</output>}
        {success && <output className="success" aria-live="polite"><Check size={18} /> Orden {orderNumber} registrada. Te contactaremos para confirmar disponibilidad y entrega.</output>}
      </form>
    </div></section>
  </main>;
}
