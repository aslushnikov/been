const mapElement = document.querySelector('.worldmap');
const mapLoaded = new Promise(resolve => mapElement.onload = resolve);

window.addEventListener('DOMContentLoaded', async () => {
  const response = await fetch('./countries.txt');
  const text = await response.text();
  const visited = new Set();
  for (const entry of text.split('\n')) {
    if (!entry.startsWith('+'))  
      continue;
    const countryCode = entry.substring(1).trim().split(' ')[0];
    visited.add(countryCode);
  }
  await mapLoaded;

  const svgDocument = mapElement.contentWindow.document;

  // Add our styles to the nested SVG.
  const linkElm = svgDocument.createElementNS('http://www.w3.org/1999/xhtml', 'link');
  linkElm.setAttribute('href', 'mapstyles.css');
  linkElm.setAttribute('type', 'text/css');
  linkElm.setAttribute('rel', 'stylesheet');
  svgDocument.querySelector('defs').appendChild(linkElm);

  // Mark countries as visited and add "title" to them all.
  const countries = svgDocument.querySelectorAll('svg > g > path');
  for (const country of countries) {
    const titleElement = svgDocument.createElement('title');
    titleElement.textContent = country.getAttribute('title');
    country.appendChild(titleElement);
    if (visited.has(country.id))
      country.classList.add('visited');
  }
});
