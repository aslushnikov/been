class Country {
  constructor(region, id, name, element, visited) {
    this.region = region;
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

  zoomIntoCountry(country) {
    const rect = country.mapElement.getBBox();
    const zoomLevel = 75;
    rect.x -= zoomLevel;
    rect.y -= zoomLevel;
    rect.width += 2 * zoomLevel;
    rect.height += 2 * zoomLevel;
    this._runZoomAnimation(`${rect.x} ${rect.y} ${rect.width} ${rect.height}`);
  }

  resetZoom() {
    this._runZoomAnimation(this._initialViewbox);
  }

  _runZoomAnimation(viewBox) {
    if (this._animation)
      this._animation.pause();
    this._animation = anime({
      targets: this.element,
      easing: 'easeOutCubic',
      duration: 300,
      viewBox
    });
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
        const country = new Country(region, id, name, element, visited);
        region.countries.push(country);
      }
    }
    for (const region of this.regions)
      region.countries.sort((a, b) => a.name.localeCompare(b.name));
    this.element = svg;
    this._initialViewbox = this.element.getAttribute('viewBox');
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

  // Hover countries when hovering over
  countrylist.addEventListener('mousemove', hoverCountry, false);
  countrylist.addEventListener('mouseleave', hoverCountry, false);
  map.element.addEventListener('mousemove', hoverCountry, false);
  map.element.addEventListener('mouseleave', hoverCountry, false);

  // Reveal country when clicking
  map.element.addEventListener('click', revealCountry, false);
  map.element.addEventListener('tap', revealCountry, false);
  countrylist.addEventListener('click', revealCountry, false);
  countrylist.addEventListener('tap', revealCountry, false);

  function hoverCountry(event) {
    let target = event.target;
    let country = null;
    while (target && !(country = target[Country.Symbol]))
      target = target.parentElement;
    setHoveredCountry(country);
    event.stopPropagation();
    event.preventDefault();
  }

  function revealCountry(event) {
    let target = event.target;
    let country = null;
    while (target && !(country = target[Country.Symbol]))
      target = target.parentElement;
    if (country === revealedCountry)
      country = null;
    setRevealedCountry(country);
    event.stopPropagation();
    event.preventDefault();
  }

  let revealedCountry = null;
  function setRevealedCountry(country) {
    if (revealedCountry) {
      revealedCountry.mapElement.classList.remove('revealing');
      revealedCountry.sidebarElement.classList.remove('revealing');
    }
    revealedCountry = country;
    if (revealedCountry) {
      revealedCountry.mapElement.classList.add('revealing');
      revealedCountry.sidebarElement.classList.add('revealing');
      scrollIntoViewIfNeeded(revealedCountry.sidebarElement);
      map.zoomIntoCountry(revealedCountry);
    } else {
      setHoveredCountry(null);
      map.resetZoom();
    }
  }

  let hoveredCountry = null;
  function setHoveredCountry(country) {
    if (hoveredCountry) {
      hoveredCountry.mapElement.classList.remove('hovered');
      hoveredCountry.sidebarElement.classList.remove('hovered');
    }
    hoveredCountry = country;
    if (hoveredCountry) {
      hoveredCountry.mapElement.classList.add('hovered');
      hoveredCountry.sidebarElement.classList.add('hovered');
    }
  }
};

// Taken from https://gist.github.com/hsablonniere/2581101
function scrollIntoViewIfNeeded(element, centerIfNeeded = true) {
  if (element.scrollIntoViewIfNeeded) {
    element.scrollIntoViewIfNeeded(true);
    return;
  }

  var parent = element.parentNode,
      parentComputedStyle = window.getComputedStyle(parent, null),
      parentBorderTopWidth = parseInt(parentComputedStyle.getPropertyValue('border-top-width')),
      parentBorderLeftWidth = parseInt(parentComputedStyle.getPropertyValue('border-left-width')),
      overTop = element.offsetTop - parent.offsetTop < parent.scrollTop,
      overBottom = (element.offsetTop - parent.offsetTop + element.clientHeight - parentBorderTopWidth) > (parent.scrollTop + parent.clientHeight),
      overLeft = element.offsetLeft - parent.offsetLeft < parent.scrollLeft,
      overRight = (element.offsetLeft - parent.offsetLeft + element.clientWidth - parentBorderLeftWidth) > (parent.scrollLeft + parent.clientWidth),
      alignWithTop = overTop && !overBottom;

  if ((overTop || overBottom) && centerIfNeeded) {
    parent.scrollTop = element.offsetTop - parent.offsetTop - parent.clientHeight / 2 - parentBorderTopWidth + element.clientHeight / 2;
  }

  if ((overLeft || overRight) && centerIfNeeded) {
    parent.scrollLeft = element.offsetLeft - parent.offsetLeft - parent.clientWidth / 2 - parentBorderLeftWidth + element.clientWidth / 2;
  }

  if ((overTop || overBottom || overLeft || overRight) && !centerIfNeeded) {
    element.scrollIntoView(alignWithTop);
  }
}
