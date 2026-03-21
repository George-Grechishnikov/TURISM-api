/** После инициализации Яндекс.Карт в body часто добавляются слои — держим портал сомелье в конце */
export function bumpSommelierRootToBodyEnd() {
  const el = document.getElementById('sommelier-root')
  if (el?.parentNode) document.body.appendChild(el)
}
