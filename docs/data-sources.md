# Fontes de dados para Marés — pesquisa de 8 de novembro de 2026

## Resultado

A fonte com menor esforço de integração é a Open-Meteo Marine, que já usamos parcialmente. A documentação oficial inclui nível do mar com contribuição das marés, correntes e temperatura superficial. Isto amplia a opção gratuita, mas não equivale a uma tábua de marés oficial do ponto de pesca.

## Evidência verificada

Documentação consultada no repositório oficial `open-meteo/open-meteo-website`, commit `5fd802c7453b1471ae8a427788c0d283029fc088`:

- [Marine API, documentação](https://open-meteo.com/en/docs/marine-weather-api)
- [Fonte exata da documentação](https://github.com/open-meteo/open-meteo-website/blob/5fd802c7453b1471ae8a427788c0d283029fc088/src/routes/en/docs/marine-weather-api/+page.svelte)
- [Definição dos campos e modelos](https://github.com/open-meteo/open-meteo-website/blob/5fd802c7453b1471ae8a427788c0d283029fc088/src/routes/en/docs/marine-weather-api/options.ts)
- [Condições de utilização](https://github.com/open-meteo/open-meteo-website/blob/5fd802c7453b1471ae8a427788c0d283029fc088/src/routes/en/terms/+page.svelte)
- [README oficial: ausência de chave e suporte CORS](https://github.com/open-meteo/open-meteo#features)

### Open-Meteo

| Campos                                                                    | Utilidade                                          | Limite principal                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------- |
| `wave_height`, `wave_period`, `wave_direction`                            | Ondulação                                          | Modelo; não mede a rebentação na praia                                            |
| `sea_level_height_msl`                                                    | Variação prevista do nível do mar, incluindo marés | Referência ao nível médio global, não ao zero hidrográfico; inclui outros efeitos |
| `ocean_current_velocity`, `ocean_current_direction`                       | Contexto de correntes                              | Não representa necessariamente a corrente de um canal, lagoa ou desembocadura     |
| `sea_surface_temperature`                                                 | Contexto térmico do mar                            | Não prova a presença de uma espécie                                               |
| `wind_speed_10m`, `wind_gusts_10m`, `wind_direction_10m`, `precipitation` | Condições de pesca na costa                        | API meteorológica separada; previsões, não estações locais                        |

A documentação atribui as correntes e marés ao modelo Météo-France SMOC, via Copernicus Marine: cobertura global, grelha de aproximadamente 8 km, dados horários, horizonte de 10 dias e atualização diária. A API também documenta saída de 15 minutos para nível do mar/correntes; uma saída temporal mais fina não melhora a resolução espacial nem prova observações a cada 15 minutos.

`sea_level_height_msl` inclui marés, efeito de pressão atmosférica, altura da superfície e variações médias globais. Pode produzir valores negativos relativamente ao nível médio; não devem ser truncados. Não comparar diretamente essas alturas com tábuas referidas ao zero hidrográfico sem estabelecer o datum.

Grátis sem chave para uso não comercial, com atribuição a Open-Meteo e aos fornecedores de modelo. Termos consultados: menos de 10 000 chamadas/dia, 5 000/hora e 600/minuto; limites por IP e aplicação. Apps com anúncios/subscrições não se enquadram no exemplo gratuito. A licença aberta dos dados não elimina as condições do serviço API.

### CNES/AVISO FES2022 e PyFES

- [Software oficial PyFES](https://github.com/CNES/aviso-fes)
- [Informação oficial sobre acesso aos dados FES2022](https://github.com/CNES/aviso-fes/blob/main/data/fes2022b/README.md)

Software de previsão harmónica com licença BSD-3-Clause. Os atlas necessários não acompanham o código e são distribuídos separadamente pelo AVISO com autenticação. O README refere 18 GB de memória para descompressão dos arquivos. O acesso/licença dos dados e a possibilidade de redistribuir resultados devem ser confirmados antes de adotar. O processamento caberia num passo prévio que gera ficheiros para o Pages, não na página web. Não é a opção de menor esforço para a primeira melhoria.

### Fontes locais e observações

INAHINA: candidato prioritário para obter tábuas/observações de referência e confirmar datum, estações, calendário de publicação e permissão de reutilização. Não foi confirmada uma API nem a disponibilidade gratuita de uma tábua atual.

INAM: candidato para avisos e previsões oficiais locais. Não foi confirmada uma API gratuita reutilizável.

Não foi identificada nesta pesquisa uma fonte de observações operacionais em tempo real para Calanga ou Machubo. Falta confirmar também os pontos costeiros dessas zonas; os nomes por si só não justificam coordenadas de previsão.

## Estado dos testes

Acesso às fontes documentais no GitHub: confirmado. Pedido real à Open-Meteo Marine para Costa do Sol com os novos campos: bloqueado pelo proxy do ambiente (HTTP 403 no túnel), antes de alcançar o fornecedor. Os sites de Open-Meteo, INAHINA e INAM foram igualmente bloqueados. Isto não demonstra falha das fontes nem ausência de dados em Moçambique. CORS está documentado pelo fornecedor, mas não foi verificado numa resposta real nesta sessão.

Consulta proposta para validar Costa do Sol (ponto aproximado já usado na app):

```text
https://marine-api.open-meteo.com/v1/marine?latitude=-25.913&longitude=32.652&hourly=wave_height,sea_level_height_msl,ocean_current_velocity,ocean_current_direction,sea_surface_temperature&forecast_days=2&timezone=Africa%2FMaputo&cell_selection=sea
```

Repetir para Macaneta e Ponta do Ouro; usar Calanga/Machubo só depois de marcar um ponto. Verificar unidades, valores nulos, horizonte real, coordenadas da célula devolvida e distância ao pesqueiro. Se possível, comparar horários de máximos/mínimos com uma referência INAHINA, separando diferenças de datum de diferenças de fase.

## Prioridade recomendada

1. Validar os novos campos da Open-Meteo em coordenadas concretas, sem alterar a app publicada antes de verificar o contrato.
2. Acrescentar nível do mar modelado, temperatura e correntes como informação experimental; manter claramente a confiança limitada em baías/estuários.
3. Só derivar janelas de máximos/mínimos e amplitude local depois de avaliar resolução temporal e comparação com referências locais. Não chamar a esses valores tábuas oficiais.
4. Obter uma fonte local autorizada para validar e corrigir a interpretação das marés. FES fica como alternativa de processamento próprio, condicionada ao acesso aos atlas.
