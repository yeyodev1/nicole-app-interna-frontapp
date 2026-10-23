<script setup lang="ts">
// Panel decorativo de la izquierda en la pantalla de acceso.
</script>

<template>
  <aside class="brand-panel">
    <div class="brand-top">
      <span class="brand-dot"></span>
      <span class="brand-name">Nicole <em>Pastry Arts</em></span>
    </div>

    <div class="brand-copy">
      <h2>Operación diaria,<br />en un solo lugar.</h2>
      <p>Pedidos, producción, reposición de islas y cierres del día.</p>
    </div>

    <ul class="brand-points">
      <li><i class="fa-solid fa-cart-shopping"></i> Pedidos y facturación</li>
      <li><i class="fa-solid fa-kitchen-set"></i> Producción y despachos</li>
      <li><i class="fa-solid fa-store"></i> Sucursales y cierre del día</li>
    </ul>

    <span class="brand-foot">Uso interno · Nicole Pastry Arts</span>
  </aside>
</template>

<style lang="scss" scoped>
.brand-panel {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 2rem;
  padding: 2.75rem 3rem;
  color: white;
  background:
    radial-gradient(circle at 15% 12%, rgba(255, 255, 255, 0.18), transparent 45%),
    linear-gradient(155deg, $purple-dark 0%, $NICOLE-PURPLE 58%, $purple-light 100%);

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    background-image: radial-gradient(rgba(255, 255, 255, 0.13) 1px, transparent 1px);
    background-size: 22px 22px;
    opacity: 0.55;
    pointer-events: none;
  }

  > * { position: relative; z-index: 1; }

  @media (max-width: 860px) { display: none; }
}

.brand-top {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.05rem;
  font-weight: 800;

  em { font-style: normal; font-weight: 400; opacity: 0.85; }
}

.brand-dot {
  width: 11px;
  height: 11px;
  border-radius: 50%;
  background: white;
  box-shadow: 0 0 0 5px rgba(255, 255, 255, 0.2);
  flex-shrink: 0;
}

.brand-copy {
  h2 {
    margin: 0 0 0.75rem;
    font-family: $font-principal;
    font-size: clamp(1.9rem, 3.2vw, 2.9rem);
    line-height: 1.15;
    font-weight: 700;
  }

  p {
    margin: 0;
    max-width: 30ch;
    font-size: 1rem;
    line-height: 1.6;
    color: rgba(255, 255, 255, 0.85);
  }
}

.brand-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.7rem;

  li {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.92rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.93);
  }

  i {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    background: rgba(255, 255, 255, 0.15);
    border: 1px solid rgba(255, 255, 255, 0.2);
    flex-shrink: 0;
  }
}

.brand-foot {
  font-size: 0.74rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.58);
}
</style>
