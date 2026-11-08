# Marés — pesca de costa em Moçambique

Aplicação web em português para acompanhar zonas de pesca no sul de Moçambique, guardar favoritos, organizar pinos com grupos e tags, consultar previsões meteorológicas/marinhas e planear saídas. Sem chave de API, conta ou subscrição para utilização pessoal não comercial.

## Executar

Requer Node.js **24.5 ou posterior** (testado com 24.22) e npm.

```sh
npm ci
npm run dev
```

O servidor usa a porta 3000 e escuta em `0.0.0.0`. `PORT=3001 npm run dev` permite escolher outra porta. Em produção:

```sh
npm run build
npm start
```

O mesmo servidor Express entrega a interface e `/api`; não é preciso CORS nem um serviço de base de dados. Vite/React/TypeScript foram usados para manter o desenvolvimento e a execução local simples. A API permanece no servidor para partilhar cache entre utilizadores. O Node respeita o proxy do ambiente (`--use-env-proxy`), mantendo a validação TLS.

## Publicar gratuitamente no GitHub Pages

O modo Pages é totalmente estático: o navegador consulta diretamente os endpoints públicos do Open-Meteo por HTTPS/CORS, sem Express, segredos ou funções pagas. O mesmo código de validação, cache e recomendações é reutilizado. A cache fica em memória por separador/sessão e reinicia ao recarregar; não é partilhada entre visitantes. Os fornecedores recebem as coordenadas consultadas. Favoritos, grupos e pinos continuam privados ao navegador, mas não são transferidos automaticamente entre a origem local e o site publicado.

1. No repositório GitHub, abra **Settings → Pages → Build and deployment → Source → GitHub Actions**.
2. O workflow `.github/workflows/pages.yml` executa testes, compila e publica em cada push para `main`. Também pode iniciá-lo em **Actions → Publicar Marés no GitHub Pages → Run workflow**. Se a primeira execução falhar por Pages ainda não estar ativo, ative a opção anterior e execute novamente.
3. Aguarde a conclusão do job `deploy`. Use o endereço exibido pelo GitHub em **Settings → Pages** ou no ambiente `github-pages`.

No plano GitHub Free, Pages está disponível para repositórios públicos. Não foi alterada a visibilidade do repositório. O código do site será público; não adicione chaves, segredos ou dados pessoais à compilação. O plano gratuito do Open-Meteo continua sujeito a uso não comercial e aos seus limites.

Para gerar e testar a versão estática:

```sh
npm ci
npm run build:pages
npm run preview:pages
```

Os recursos usam caminhos relativos (`base: "./"`), compatíveis com o subdiretório do repositório. A aplicação não depende de rotas `/api` no modo Pages. `npm run build` mantém o modo com servidor para desenvolvimento/alojamento Node. Os ficheiros a publicar são apenas os de `dist/`.

Testes de navegador para a versão Pages: `PAGES_TEST=1 BASE_URL=<endereço-do-servidor-estático-com-subdiretório> npm run test:browser`. Os testes verificam também a ausência de pedidos ao backend. As respostas externas dos testes são fixtures, não uma validação do acesso real ou do CORS do fornecedor.

## Funcionalidades

- Dashboard dos favoritos, estado previsto na hora atual e janela em destaque e todas as janelas elegíveis por data.
- Dez zonas: Costa do Sol, Calanga, Machubo, Catembe, Macaneta, costa oceânica de Bilene, Praia do Xai-Xai, Chidenguele, Ponta Malongane e Ponta do Ouro.
- Calanga e Machubo estão incluídas com **coordenadas por confirmar**. Defina o ponto pelo mapa ou pelas coordenadas; até lá não são atribuídas previsões.
- Mapa Leaflet/OpenStreetMap com seleção de zonas. Se os mosaicos falharem, a lista continua funcional.
- Até 50 pinos pessoais na área aproximada do sul (latitude −27 a −23, longitude 32 a 36); validação de limites não garante que o ponto esteja na costa ou seja acessível.
- Até 30 grupos pessoais, com nome editável e até 10 tags por grupo. Cada ponto pode pertencer a vários grupos. Filtros por grupo e tag intersectam-se. Eliminar um grupo preserva os pinos.
- Calendário de 30 dias com cálculo lunar e previsões limitadas ao horizonte devolvido pelo fornecedor (pedido de 7 dias).
- Janelas diurnas futuras agrupadas por continuidade e classe, com potencial alto/bom/moderado, motivos, intervalos de vento/ondas e gravação individual do início/fim. O calendário mostra a quantidade por dia; o detalhe da zona permite mudar de data.
- Gráficos e tabela horária de vento e ondas, motivos das recomendações, fontes e horas de recolha.
- Saídas guardadas, favoritos, pinos, coordenadas e grupos persistidos em `localStorage`. Sem sincronização entre dispositivos; limpar os dados do navegador elimina esses registos.
- Interface responsiva, diálogos com foco e Escape, controlos com etiquetas e estados de erro/vazio.

## Dados e limitações

**Open-Meteo Weather** (`api.open-meteo.com`): temperatura, precipitação, vento, direção e rajadas. **Open-Meteo Marine** (`marine-api.open-meteo.com`): altura, direção e período das ondas. Uma consulta independente ao modelo `meteofrance_currents` acrescenta `sea_level_height_msl`, `ocean_current_velocity`, `ocean_current_direction` e `sea_surface_temperature`. São previsões de modelos, não observações de boias ou estações. Unidades verificadas pelo fornecedor partilhado (servidor ou navegador); valores ausentes permanecem ausentes. Os pontos marinhos devolvidos pelo fornecedor são mostrados na metodologia; a resolução pode ser insuficiente para canais, recifes e a Baía de Maputo.

Cache em memória de uma hora por ponto/fonte; erros têm espera de 5 minutos. Pedidos simultâneos para a mesma fonte são agrupados. Até 200 entradas de cache; limite global de 120 pedidos de previsão/minuto. O navegador consulta a cada 15 minutos. Dados retidos após falhas ficam assinalados, não geram recomendações e expiram após 6 horas. Recolhas com mais de 90 minutos também não geram recomendações. A hora da recolha não é a hora de emissão do modelo.

A API pública gratuita do Open-Meteo destina-se a **utilização não comercial**, sujeita a limites e [termos do fornecedor](https://open-meteo.com/en/terms). Dados meteorológicos com atribuição CC BY 4.0. Rever condições antes de uso comercial ou publicação em escala. Mapas © OpenStreetMap contributors, conforme [política de mosaicos](https://operations.osmfoundation.org/policies/tiles/); não são descarregados para uso offline. Não há garantia de disponibilidade contínua de serviços gratuitos. Não é necessário contratar alojamento para o modo GitHub Pages.

**Painel oceanográfico:** nível do mar em metros relativamente ao nível médio global (MSL), corrente em km/h com direção de destino, e temperatura superficial em °C. Dados Météo-France SMOC, gerados com informação do [Copernicus Marine Service](https://doi.org/10.48670/moi-00016), via Open-Meteo. Grelha aproximada de 8 km, atualização diária. As curvas e os extremos são estimativas de modelo que incluem marés e efeitos meteorológicos; não são observações nem alturas sobre o zero hidrográfico. Valores negativos são preservados. Os máximos/mínimos horários exigem duas amostras vizinhas válidas e contíguas; lacunas, extremos dos intervalos e patamares não originam eventos inventados. A tendência representa a diferença entre a amostra horária atual e a seguinte.

A consulta oceanográfica tem validade e tratamento de erros próprios. Uma falha desta fonte não invalida vento/ondas nem a avaliação anterior. Dados oceanográficos retidos são assinalados como desatualizados e não produzem eventos futuros. Os novos campos são informativos: ainda não alteram o score de pesca sem calibração local. A tabela horária permite inspecionar os valores.

**Astronomia local:** SunCalc calcula Lua, nascer e pôr do sol por coordenada, com apresentação em `Africa/Maputo`. Marés vivas/mortas são aproximações pelo ciclo lunar: distância de fase <0,08 ciclos da Lua nova/cheia ou dos quartos. Não há fonte de maré local validada. A aplicação **não mostra horários/alturas de maré, corrente, enchente ou vazante inventados**. O atraso local do ciclo de amplitude não é conhecido.

**Recomendação parcial:** condições promissoras exigem luz diurna, vento ≤18 km/h, ondas ≤1,5 m, período <12 s e chuva <1 mm/h. As janelas até 90 minutos após o nascer/antes do pôr do sol têm prioridade. Estuários ficam limitados a avaliação razoável pela representatividade do modelo. Vento ≥30 km/h, rajadas ≥45 km/h, ondas ≥2,5 m ou chuva ≥5 mm/h acionam condições adversas. Dados essenciais ausentes/desatualizados impedem recomendações; alertas sobre valores adversos conhecidos podem continuar a aparecer com outra variável ausente. Regras iniciais não calibradas com capturas locais; não estimam probabilidade de captura nem certificam segurança. Espécie, direção relativa à costa e restrições legais locais não entram automaticamente no cálculo.

## Rede do ambiente cloud

Permitir os seguintes domínios, além dos registos de pacotes:

- `api.open-meteo.com`
- `marine-api.open-meteo.com`
- `tile.openstreetmap.org`

Foi guardado um rascunho com estes domínios. O teste real neste ambiente recebeu bloqueio HTTP 403 do proxy; a consulta real dos fornecedores e o mapa base permanecem por validar após aplicar a configuração. Não são necessários segredos. Fora deste ambiente, o servidor precisa de acesso HTTPS normal aos dois fornecedores. O navegador precisa de acesso ao servidor de mapas.

## Verificação

```sh
npm test
npm run build
# Com o servidor em execução e Chromium instalado:
npm run test:browser
```

`CHROMIUM_PATH` permite escolher o executável e `BASE_URL` outro endereço de teste. Testes de domínio/API usam payloads sintéticos exclusivamente em `tests/`; não existe modo demo com dados fictícios na aplicação. O teste de navegador verifica falhas, grupos, tags, pinos, persistência, calendário, saídas, diálogos e layout móvel; o cenário com previsão é interceptado por fixtures e não comprova acesso ao fornecedor real. Capturas ficam em `test-results/` (ignorado pelo Git).

## Estrutura

- `src/main.tsx`: interface e persistência local.
- `src/domain.mjs`: zonas, astronomia e regras de avaliação.
- `src/ocean.mjs`: direção, tendência e extremos horários do nível do mar modelado.
- `src/style.css`: interface responsiva.
- `src/provider.mjs`: implementação partilhada das fontes, unidades, junção temporal e cache.
- `server/provider.mjs`: reexportação usada no modo servidor.
- `server/index.mjs`: servidor e validação dos pedidos.
- `tests/`: testes funcionais e de domínio.

Próximos passos: validar os pontos de Calanga/Machubo, comparar previsões reais com referências locais e obter uma fonte gratuita autorizada para marés. Não é necessária uma API paga para utilizar as funcionalidades já implementadas.

## Todas as janelas e indicador qualitativo

`fishingWindows` avalia todas as amostras horárias ainda por iniciar para a data em `Africa/Maputo`. Inclui condições promissoras e razoáveis durante o dia; exclui noite, alertas adversos, dados incompletos/desatualizados e locais por confirmar. Horas consecutivas da mesma classe e data são agrupadas. Lacunas ou mudanças de classe separam períodos, e o fim é limitado ao pôr do sol (arredondado para baixo ao minuto) e à última amostra disponível +1h.

- **Potencial alto:** condições promissoras numa amostra até 90 minutos após o nascer/antes do pôr do sol.
- **Potencial bom:** restantes condições promissoras diurnas.
- **Potencial moderado:** condições razoáveis diurnas, incluindo limitações do modelo em estuários.

Não representa probabilidade de captura ou segurança. Os níveis usam as regras explicadas acima; não adicionam informação de espécie, maré local validada ou calibração por capturas. Cada janela mostra os motivos agregados e permite guardar início e fim. Saídas antigas sem fim continuam compatíveis. A janela em destaque pertence à mesma lista e prioriza a classe mais alta, depois o horário mais cedo.
