# SPEC UNIVERSAL DE SPRITES — v3

Autoridade única para os 9 heróis do roster. Todo asset novo ou rebuild DEVE
seguir este documento. `tools/validate_assets.py` implementa estas regras como
checagens executáveis; `tools/smoke_test.js` cobre UI/fluxos.

## 1. Roster (fixo, 9 heróis)
`spiderman, venom, ironman, capamerica, hulk, wolverine, drstrange,
blackpanther, antman` — sem outros heróis, sem skins listadas como herói
(`heroes[].skins` fica dentro do card do herói, nunca como rack próprio).

## 2. Frame universal
- Todo frame de gameplay: **112×112 px**, RGBA, **alpha binário** (0 ou 255).
- Baseline fixa: **y = 106** para poses apoiadas; pivot horizontal = centro
  das pernas (braço esticado ou efeito não desloca o corpo).
- **Um fator de downscale inteiro por sheet** — com voto de maioria por bloco
  (nunca média/BOX: é o que causava o blur no app).
- Nada é cortado: o recorte é por *blob* conectado + bandas de projeção, não
  por grade fixa (a grade fixa era a causa do "hulk cortado").

## 3. Strip de animação (1 por herói)
`public/assets/anim/<hero>.png` = N frames de 112px na ordem
**idle → walk → attack → ability**. Cada herói pode ter quantidades
diferentes de frames; a tabela vem de `public/data/anim.json`
(`{frame, frames{}, anims{start,count,fps,loop}, source}`).

| anim    | loop | fps (n=4) | observação                                  |
|---------|------|-----------|---------------------------------------------|
| idle    | sim  | 3         | respiração, sem drift de chão               |
| walk    | sim  | 4         | ciclo real contact→passing→contact oposto   |
| attack  | não  | 3         | golpe com recuo, termina em idle            |
| ability | não  | 3         | especial; pode levantar voo (tol. de chão 25%) |

### Backdrop das sheets
Toda sheet de herói (`art2/hero_<id>.png` ou `art_ai/*`) é lida por
`sprites_lib.silhouette()`:
1. cor de fundo **por linha** (mediana das bordas) → tolerância 26–30;
2. **closing** para fechar o contorno claro do personagem;
3. **fill holes** — o corpo pode ser preto sobre fundo escuro (simbionte,
   pantera): a silhueta é o que define o sprite, não a cor;
4. maior componente conexo, ruído descartado, regras verticais de separação
   da sheet apagadas (`strip_rules`), fragmentos de painel removidos.

## 4. Renderização
- `imageSmoothingEnabled = false` e `canvas { image-rendering: pixelated }`.
- Backing store = `frames × escala_inteira × DPR arredondado`; CSS derivado do
  backing (pixels 1:1 com o device, inclusive em DPR fracionário).
- Um único ticker rAF (`anim.js`); culling por IntersectionObserver; sheets
  decodificadas 1× e compartilhadas.
- `setAnim` desconhecido → `idle`.

## 5. Back blings (exatamente 12)
- Catálogo em `blings[]` com `size ∈ {S,M,L}` e
  `attach = {dx, dy, layer, perHero{hulk:{...}}}`; **offsets inteiros**.
- Cada bling é pré-assado em `public/assets/bling/<id>_{16,24,32}.png`
  (divisões inteiras do ícone de 96px): em jogo ele é desenhado 1:1 na escala
  do herói, nunca redimensionado no browser (sem blur, sem gigante).
- Tamanho efetivo: herói S/M → bling S=16 / M=24 / L=32; herói L →
  S=24 / M=32 / L=32 (nada minúsculo nas costas do Hulk).
- Locker mostra o **ícone** do bling; o palco continua compondo herói + bling
  equipados com os assets de jogo.

## 6. Herói vs Skin / Locker / Shop
- Locker: racks **HERÓI / BACK BLING / RELÍQUIAS** em ícones (nunca o boneco);
  o palco animado é o único lugar com o herói desenhado.
- Shop: uma seção por categoria, **cor própria** (`shopCats[].color`), sem
  linha de separação, sem número de categoria, sem contador de itens, sem
  rótulos de tipo/grupo; cards entram com animação escalonada (`cardIn`) toda
  vez que a categoria aparece. O pacote fica **ao lado** do herói em destaque
  e os outros itens abaixo — itens continuam sendo comprados separadamente.
- 1 relíquia (picareta) por herói, uma por categoria.

## 7. Checklist de auditoria final (executável)
1. `python tools/validate_assets.py` → `ALL ASSETS VALID`;
   strip múltiplo de 112px, alpha binário, 4 anims por herói, sem frame
   vazio/dust/duplicado, drift de chão ≤ 6px (≤ 25% no ability);
2. 12 blings com ícone + 3 tamanhos assados + metadata; sem recorte de borda;
3. 9 ícones de herói e 9 relíquias presentes;
4. `npm run smoke` → 47/47 (loja por categoria, transições, locker por
   ícones, economia, remoção total de gliders/emotes);
5. inspeção visual por contact sheet dos 9 strips.
