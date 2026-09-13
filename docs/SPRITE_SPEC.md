# SPEC UNIVERSAL DE SPRITES — v2 (round 9)

Autoridade única para os 9 heróis do roster. Todo asset novo ou rebuild DEVE
seguir este documento. `tools/validate_assets.py` implementa estas regras como
checagens executáveis; `tools/smoke_test.js` cobre UI/fluxos.

## 1. Roster (fixo, 9 heróis)
`spiderman, venom, hulk, capamerica, ironman, wolverine, antman, blackpanther, drstrange`
Sem outros heróis. Skins ≠ heróis (visual-only, mesma identidade/stats).
Pickaxes e sistemas compartilhados permanecem. Ícones codificados
`public/assets/spr/<hero>.png` NUNCA são substituídos por geração.

## 2. Frame universal
- Todo frame de gameplay: **48×48 px**, RGBA, **alpha binário** (0 ou 255;
  nunca semi-transparente: sem halo/AA/blur/opacity).
- Baseline fixa: **y = 47** para poses apoiadas; pivot horizontal central.
- Extração **determinística por retângulo fixo**:
  `cell = sheet[r*h//4 : (r+1)*h//4, c*w//6 : (c+1)*w//6]`.
  Proibido auto-crop para redefinir limites de frame.
- Reparo de straddle: se o gerador desenha a pose cruzando a linha de grade,
  o blob conectado do personagem é atribuído INTEIRO à célula de maior
  overlap (busca em janela de ±meia célula). O retângulo do frame não muda.
- Célula ilegível (mascara < 64 px) → frame vizinho válido da mesma animação,
  com log de build.

## 3. Strip de animação (1 por herói)
`public/assets/anim/<hero>.png` = **24 frames** de 48px → **1152×48**.
Quatro animações de 6 frames, todas na MESMA sheet gerada por herói
(`art2/hero_<id>.png`, 4 linhas × 6 colunas — 1 imagem garante 1 estilo):

| linha sheet | anim    | start | frames | fps | loop   |
|-------------|---------|-------|--------|-----|--------|
| 0           | idle    | 0     | 6      | 4   | loop   |
| 1           | walk    | 6     | 6      | 9   | loop seamless (ciclo real: contact/down/passing/high/opostos) |
| 2           | attack  | 12    | 6      | 10  | once   |
| 3           | ability | 18    | 6      | 8   | once   |

Abilities por slot (design de gameplay + animação): 1 web shot (+ passiva
danger sense como 10º conceito), 2 symbiote lunge, 3 ground smash,
4 shield throw, 5 repulsor blast, 6 claw dash, 7 shrink (frames de transição
desenhados, não scale em runtime), 8 shadow pounce, 9 mystic portal.

### Backdrop das sheets
O gerador NÃO entrega alpha real. Pede-se transparência; o pipeline aceita
qualquer backdrop por **keying multi-bucket**: buckets quantizados cumulativos
que cobrem ≥55% da folha = fundo (cobre cor chapada, checkerboard de falsa
transparência e gradiente). Sprite = pixels longe de todos os buckets de fundo
e longe do branco das linhas de grade; maior blob; furos preenchidos.
Folha **magenta `#ff00ff`** = fallback obrigatório quando o corpo do herói
confunde com o checker (caso venom/spiderman: preto/cinza = tons do checker).
Vazamento de key-color dentro do blob = inpaint nearest-neighbour.

## 4. Renderização
- `imageSmoothingEnabled = false` em todo canvas; CSS global
  `canvas { image-rendering: pixelated }`.
- Downscale de asset SOMENTE por decimação NEAREST de razão inteira
  (`scale_px`); BOX/area-average proibido (causa blur no app).
- Backing store do canvas = múltiplo inteiro de 48; CSS derivado do backing
  (backing px == device px mesmo em DPR fracionado).
- **Um único ticker rAF** (`anim.js`); culling por IntersectionObserver;
  cleanup em unmount; texturas decodificadas 1 vez (cache).
- `setAnim` desconhecido → `idle` (strip nunca morre).

## 5. Back blings (12 itens)
- Sheet única `art2/bling_sheet.png` (3 linhas × 4 colunas) com 12
  equipamentos icônicos — nunca rostos.
- Catalog: `gliders[] = {id,name,rarity,art,anim,attach}` com
  `attach = {dx,dy,s,layer,perHero{hid:{...}}}`; `s ∈ {0.5,1,2}`,
  `layer ∈ {behind,front}`; default renderer `{dx:0,dy:8,s:1,behind}`.
- Tamanho adaptado ao herói: `heroes[].size ∈ {S,M,L}` + overrides `perHero`
  (antman 0.5; hulk 2 p/ gear pequeno, 1 p/ gear grande).
- Capitão América: escudo NÃO equipado por default.
- Locker mostra o **ícone** do bling (não o bling montado no herói); o palco
  do locker continua compondo herói+bling equipados com os assets de jogo.

## 6. Herói vs Skin / Locker / Shop
- `heroes[].skins = []`; skins aparecem DENTRO do card do herói no rack HERÓI
  do locker (chips clicáveis), nunca como rack/duplicata própria.
- Shop: scroll vertical livre, 5 seções por categoria, cards compactos,
  obtido substitui preço, sem etiquetas Epic/Outfit/New, sem emotes.

## 7. Checklist de auditoria final (por herói, executável)
1. strip 1152×48, 24 frames, alpha binário;
2. idle/walk/attack sem drift de chão (tol 1/2/3) e sem drift de topo >8px;
3. walk anda de verdade (diff de silhueta mediano ≥40 px) e loopa
   (diff wrap ≤3× mediana; sem frames duplicados);
4. sem frame esparso (<35% da mediana de px) ou stunted em segmentos upright;
5. blings: 12 ícones sem rosto, attach metadata, sem recorte de borda;
6. smoke 69/69 + validator `ALL ASSETS VALID`;
7. inspeção visual por contact sheet (`.shot/va_<hero>.png`).
