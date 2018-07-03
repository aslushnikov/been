class Country {
  constructor(id, name, element, visited) {
    this.id = id;
    this.name = name;
    this.visited = visited;
    this.mapElement = element;
    this.mapElement.classList.toggle('visited', visited);
    this.mapElement[Country.Symbol] = this;
    // Create title for country.
    const titleElement = element.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'title');
    titleElement.textContent = this.name;
    this.mapElement.appendChild(titleElement);

    // Create sidebar entry.
    this.sidebarElement = document.createElement('div');
    this.sidebarElement.classList = 'entry';
    this.sidebarElement.classList.toggle('visited', visited);
    this.sidebarElement.textContent = this.name;
    this.sidebarElement[Country.Symbol] = this;
  }
}

Country.Symbol = Symbol('country');

class Region {
  constructor(name) {
    this.name = name;
    this.countries = [];
  }
}

class Map {
  static async create() {
    const [svgText, countriesText] = await Promise.all([
      fetch('./world.svg').then(response => response.text()),
      fetch('./countries.md').then(response => response.text())
    ]);
    const domParser = new DOMParser();
    const parsedDocument = domParser.parseFromString(svgText, 'text/html');
    const foreignSVG = parsedDocument.querySelector('svg');
    const svg = document.importNode(foreignSVG, true);
    return new Map(svg, countriesText);
  }

  constructor(svg, countriesText) {
    this.regions = [];
    let region = null;
    for (let entry of countriesText.split('\n')) {
      entry = entry.trim();
      if (!entry.length)
        continue;
      if (entry.startsWith('# ')) {
        region = new Region(entry.substring(2).trim());
        this.regions.push(region);
      } else {
        const match = entry.match(/^-\s*\[(.*)\]\s+([A-Za-z]{2})\s+(.*)$/);
        if (!match) {
          console.error('Failed to parse line!\n  ' + entry);
          continue;
        }
        const visited = !!match[1].trim();
        const id = match[2];
        const name = match[3];
        const element = svg.querySelector('#'+ id);
        const country = new Country(id, name, element, visited);
        region.countries.push(country);
      }
    }
    for (const region of this.regions)
      region.countries.sort((a, b) => a.name.localeCompare(b.name));
    this.element = svg;
  }
}

Promise.all([
  Map.create(),
  new Promise(x => window.addEventListener('DOMContentLoaded', x, false))
]).then(onMapLoaded);

async function onMapLoaded([map]) {
  const $ = document.querySelector.bind(document);
  // Append map to DOM.
  const container = $('.map');
  container.appendChild(map.element);

  // Build sidebar.
  const countrylist = $('.countrylist');
  for (const region of map.regions) {
    const visitedCountries = region.countries.filter(country => country.visited).length;
    const regionElement = document.createElement('div');
    regionElement.classList.add('region');
    regionElement.innerHTML = `
      <div class=region-title>
        <h3>${region.name}</h3><span>${visitedCountries}/${region.countries.length}</span>
      </div>
    `;

    countrylist.appendChild(regionElement);
    for (const country of region.countries)
      regionElement.appendChild(country.sidebarElement);
  }

  // Update title
  const countries = map.regions.reduce((all, region) => [...all, ...region.countries], []);
  const totalVisited = countries.filter(c => c.visited).length;
  $('header h3').textContent = `Visited: ${totalVisited}/${countries.length}`;

  // Handle click on map to scroll sidebar.
  map.element.addEventListener('click', revealCountryInSidebar, false);
  map.element.addEventListener('touchend', revealCountryInSidebar, false);

  // Handle click for sidebar
  countrylist.addEventListener('mousemove', revealCountryOnMap, false);
  countrylist.addEventListener('mouseleave', revealCountryOnMap, false);
  countrylist.addEventListener('touchend', revealCountryOnMap, false);

  function revealCountryOnMap(event) {
    let target = event.target;
    let country = null;
    while (target && !(country = target[Country.Symbol]))
      target = target.parentElement;
    setRevealedCountry(country);
  }

  let revealedCountry = null;
  function setRevealedCountry(country) {
    if (revealedCountry)
      revealedCountry.mapElement.classList.remove('revealing');
    revealedCountry = country;
    if (revealedCountry)
      revealedCountry.mapElement.classList.add('revealing');
  }

  function revealCountryInSidebar(event) {
    let target = event.target;
    let country = null;
    while (target && !(country = target[Country.Symbol]))
      target = target.parentElement;
    if (!country)
      return;
    country.sidebarElement.scrollIntoView({block2: '', inline: 'center', behavior: 'smooth'});
    setRevealedCountry(country);
    event.stopPropagation();
    event.preventDefault();
  }
};
