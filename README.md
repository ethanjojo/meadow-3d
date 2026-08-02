# Živá louka

Pasivní 3D přírodní zážitek pro prohlížeč. Instancovaná tráva se ohýbá ve vrstvách GPU větru, světlo plynule prochází dnem a nocí a prostředí postupně navazuje jaro, léto, podzim a zimu.

## Spuštění

```bash
npm install
npm run dev
```

Lokální stránka poběží na adrese, kterou vypíše Vite, standardně `http://localhost:5173`.

## Ověření

```bash
npm test
npm run lint
npm run build
npm run test:e2e
```

- `npm test` spustí jednotkové a komponentové testy.
- `npm run lint` provede striktní kontrolu TypeScriptu.
- `npm run build` vytvoří produkční výstup ve složce `dist`.
- `npm run test:e2e` ověří desktopové a mobilní zobrazení v Chromiu.

## Ovládání a výkon

Scéna je záměrně pasivní: kamera se pohybuje pouze jemně a reaguje lehkou paralaxou na kurzor. Zvuk je po načtení vždy vypnutý a lze ho zapnout tlačítkem v pravém dolním rohu.

Hustota trávy, počet částic, rozlišení a stíny se automaticky přizpůsobují výkonu zařízení. `prefers-reduced-motion` omezuje kameru a částice, ale nevypíná denní ani sezónní cyklus. Pokud WebGL není dostupné, stránka zobrazí statickou náhradní louku.
