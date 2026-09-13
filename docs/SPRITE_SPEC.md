# SPEC UNIVERSAL DE SPRITES — v1 (round 8)

Autoridade única para todos os 9 heróis do roster. Qualquer asset novo ou
rebuild DEVE seguir este documento. O validator (`tools/validate_assets.py`)
implementa estas regras como checagens executáveis.

## 1. Roster (fixo, 9 heróis)
`spiderman, venom, hulk, capamerica, ironman, wolverine, antman, blackpanther, drstrange`
Sem outros heróis, sem skins duplicando herói base. Pickaxes e sistemas
compartilhados permanecem.

## 2. Frame universal
- Todo frame de gameplay: **48×48 px**, RGBA, alpha binário (0 ou 255 — nunca
  semi-transparente: sem halo, sem AA, sem blur, sem opacity).
- Baseline (linha do chão) fixa: **y = 47** para poses apoiadas.
- Pivot central horizontal: silhueta centrada no frame (bbox centralizada pelo
  pipeline, nunca pela mão do modelo).
- Extração **determinística por retângulo fixo**: cell `(row, col)` =
  `img[r*h//rows : (r+1)*h//rows, c*w//6 : (c+1)*w//6]`. Proibido auto-crop
  para "adivinhar" limites de frame.

## 3. Strip de animação (1 por herói)
`public/assets/anim/<hero>.png` = **42 frames** de 48px → 2016×48.

| anim    | start | frames | fps | loop  | uso                        |
|---------|-------|--------|-----|-------|----------------------------|
| idle    | 0     | 6      | 4   | loop  | menus, locker, jogo parado |
| walk    | 6     | 6      | 9   | loop  | locomoção (loop seamless)  |
| attack  | 12    | 6      | 10  | once  | melee                      |
| ability | 18    | 6      | 8   | once  | habilidade única do herói  |
| jump    | 24    | 2      | 8   | once  | subida                     |
| fall    | 26    | 2      | 6   | loop  | queda                      |
| land    | 28    | 2      | 10  | once  | aterrissagem               |
| hurt    | 30    | 2      | 10  | once  | dano                       |
| death   | 32    | 4      | 6   | once  | eliminação                 |
| sense   | 36    | 6      | 6   | once  | sentido/reação passiva     |

Deslocamento vertical aplicado pelo renderer (px, inteiro):
`jump [-3,-7]`, `fall [-9,-7]`, `land [-2,0]`, `walk ±WALK_BOB`.

## 4. Sheet master por herói (fonte única)
`art2/sheet_<hero>.png` = **7 linhas × 6 colunas = 42 células iguais**,
fundidas pelo pipeline a partir de 3 chunks de geração (o gerador de imagem é
confiável apenas com grades simples; grades 6×6 mistas degeneram):

| chunk | grade | linhas |
|-------|-------|--------|
| `art2/s1_<hero>.png` | 2×6 | idle(6) / walk(6) |
| `art2/s2_<hero>.png` | 2×6 | attack(6) / ability(6) |
| `art2/s3_<hero>.png` | 3×6 | jump2+fall2+land2 / hurt2+death4 / sense(6) |

Layout da sheet master (linhas 0-6): idle, walk, attack, ability,
jump/fall/land, hurt/death, sense. Células separadas por linhas de grade
brancas finas; fundo chapado **magenta chroma-key `#ff00ff`** (keying
determinístico por cor modal + remoção de barras de grade). Magenta é distante
de qualquer paleta de herói (o navy `#10142c` falhou para personagens pretos:
simbionte sombreado era comido pelo keying). Sheets legacy navy permanecem
válidas onde já extraídas; gerações novas usam magenta.

Reparo determinístico em build: célula ilegível (máscara < 24px de altura ou
< 9600 px²) é substituída pelo frame válido mais próximo da mesma animação,
com log `! <hero> <anim> f<n> cell unreadable`.

## 5. Regras de renderização
- `imageSmoothingEnabled = false` em todo canvas; escala sempre inteira
  (×1, ×2, ×3, ×4) ou meia (×0.5) — nunca frações que borram.
- **Um único ticker rAF** (`anim.js`) alimenta todos os canvases visíveis;
  culling por IntersectionObserver; cleanup em unmount.
- Texturas cacheadas por herói (strip decodificado 1 vez).
- Sem truques de blur/opacity/ghosting para esconder defeito de animação:
  defeito se corrige no asset ou no renderer.

## 6. Back blings (gliders)
- Apenas equipamento/objeto icônico — **nunca rosto/cabeça**.
- Proporcionados ao herói; metadados de attach **data-driven** no catalog:
  `gliders[].attach = { dx, dy, s, layer }` com `s ∈ {0.5, 1, 2}` e
  `layer ∈ {behind, front}`. Renderer não hard-coda posição por id.
- Default do renderer: `{dx:0, dy:8, s:1, layer:'behind'}`.
- Capitão América: escudo **não** equipado por default (só ao equipar/throw).
- Blings de herói usam o mesmo pixel art e paleta do herói.

## 7. Herói vs Skin (dados)
- `heroes[]` = identidade + stats. `heroes[].skins = []` = visuais alternativos
  da MESMA identidade/stats (visual-only). Shop lista skins em células
  próprias; locker rack de skins nunca lista o herói base.
- `heroes[].ability = { id, name, desc }` descreve a habilidade única
  (slot de design por herói); spiderman tem passiva extra `danger_sense`
  representada pela anim `sense`.

## 8. Shop / Locker
- Shop: scroll vertical livre, seções por categoria (5), cards compactos,
  fundos por raridade/tipo contidos, obtido substitui preço, sem etiquetas
  Épico/Traje/Novo, sem emotes.
- Locker v2: hub com preview animado usando os MESMOS assets de gameplay
  (idle do strip), slots de loadout, busca + filtros.

## 9. Checklist de auditoria final (por herói)
1. strip 2016×48, 42 frames, alpha binário;
2. idle/walk/sense sem drift de chão (>tol) e sem drift de topo >8px;
3. jump/fall aéreos (pés ≥3px acima da baseline);
4. death termina abaixado (deitado);
5. walk loop seamless (f6→f12 contínuo);
6. bling sem rosto, attach metadata presente;
7. ícone codificado `public/assets/spr/<hero>.png` intocado pelo pipeline;
8. smoke 68/68 + validator `ALL ASSETS VALID`.
