# Lumipost.ai — landing page

Landing page animada do Lumipost.ai, construída em **Next.js 16 (App Router)** com
**Three.js / React Three Fiber**, **GSAP ScrollTrigger**, **Lenis** e **Motion**.

Marca, paleta e copy foram extraídas do app real em
`../../SupabaseAppAgendamentoPubAutomatica` (tema dark de `src/index.css`,
logo de `public/assets/icon.png`, planos de `src/domain/creditRules.ts` e
`src/infrastructure/seed.ts`).

## Rodar

```bash
npm run dev
```

Outros scripts: `npm run build`, `npm start`, `npm run lint`.

## Estrutura

```
src/
  app/
    layout.tsx        fontes (Inter + Instrument Serif), metadata/OG, scroll suave
    globals.css       tokens do app + classes na layer `components`
    page.tsx          composição das seções
  components/
    SmoothScroll.tsx  Lenis sincronizado com o ticker do GSAP
    Navbar.tsx        nav flutuante + barra de progresso + menu mobile
    Hero.tsx          título, CTAs e canvas 3D de fundo
    ProductScroll.tsx seção fixada de 420vh que dirige a cena do aparelho
    Manifesto.tsx     texto que acende palavra a palavra conforme o scroll
    Features.tsx      bento grid com reveal
    FormatsRail.tsx   trilho horizontal dirigido pelo scroll (GSAP)
    Pricing.tsx       planos e pacotes de crédito
    Faq.tsx           acordeão
    FinalCta.tsx      chamada final
    Footer.tsx
  three/
    HeroCanvas.tsx    ondas + estrelas + cards flutuantes
    WaveBackground.tsx shader de fbm com domain warping
    Starfield.tsx     pontos com PRNG determinístico (SSR-safe)
    FloatingCards.tsx cards de conteúdo com parallax de mouse
    PhoneCanvas.tsx   cena do aparelho, luzes e cards em órbita
    Phone.tsx         aparelho procedural + crossfade das telas
    scrollState.ts    ponte sem re-render entre ScrollTrigger e useFrame
  lib/
    content.ts        toda a copy e os números da página
    screenTexture.ts  telas do app desenhadas em canvas 2D
    cardTexture.ts    mini cards de conteúdo em canvas 2D
```

## Como as animações funcionam

- **Scroll suave**: Lenis roda dentro do `gsap.ticker` e emite `ScrollTrigger.update`,
  então DOM e 3D leem a mesma posição.
- **Seção do produto**: a seção tem `420vh` e um filho `sticky`. O ScrollTrigger
  apenas publica o progresso em `productScroll.progress` — nenhum re-render do
  React por quadro. O `useFrame` interpola as poses do aparelho e faz o crossfade
  entre as quatro telas via shader.
- **Trilho de formatos**: `gsap.to(track, { x: -(scrollWidth - innerWidth) })`
  com `scrub`, dentro de outra seção alta com filho `sticky`.
- **Texturas**: as telas do app e os cards são desenhados em canvas 2D e viram
  `CanvasTexture` — nada de imagem externa. São repintados quando as fontes
  terminam de carregar.
- `prefers-reduced-motion` desliga o scroll suave e as animações CSS.

## Ajustes rápidos

- Copy, planos, FAQ e formatos: `src/lib/content.ts`.
- URL do app (botões "Entrar" / "Começar agora"): `APP_URL` em `src/lib/content.ts`.
- Cores: bloco `:root` em `src/app/globals.css` (espelha o tema dark do app).
- Poses do aparelho por etapa: array `POSES` em `src/three/Phone.tsx`.

## Assets

`public/assets/` tem o logo original do app (`icon.png`), as versões recortadas
(`logo.png`, `logo-512.png`, `favicon-32.png`) e a imagem de compartilhamento
(`og.png`), todas geradas a partir do logo original.
