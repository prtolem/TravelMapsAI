
import {FunctionDeclaration, GoogleGenAI, Type} from '@google/genai';


declare var ymaps: any;


let map: any; 
let allGeoPointsForBounds: number[][] = []; 
let markers: any[] = []; 
let lines: any[] = []; 
let locationDetails: LocationDetail[] = []; 
let activeCardIndex = 0; 
let isPlannerMode = false; 
let dayPlanItinerary: LocationDetail[] = []; 

interface LocationDetail {
  name: string;
  description: string;
  lat: number;
  lng: number;
  placemark?: any; 
  time?: string;
  duration?: string;
  sequence?: number;
}


const generateButton = document.querySelector('#generate') as HTMLButtonElement;
const resetButton = document.querySelector('#reset') as HTMLButtonElement;
const cardContainer = document.querySelector(
  '#card-container',
) as HTMLDivElement;
const carouselIndicators = document.querySelector(
  '#carousel-indicators',
) as HTMLDivElement;
const prevCardButton = document.querySelector(
  '#prev-card',
) as HTMLButtonElement;
const nextCardButton = document.querySelector(
  '#next-card',
) as HTMLButtonElement;
const cardCarousel = document.querySelector('.card-carousel') as HTMLDivElement;
const plannerModeToggle = document.querySelector(
  '#planner-mode-toggle',
) as HTMLInputElement;
const timelineContainer = document.querySelector(
  '#timeline-container',
) as HTMLDivElement;
const timelineEl = document.querySelector('#timeline') as HTMLDivElement;
const closeTimelineButton = document.querySelector(
  '#close-timeline',
) as HTMLButtonElement;
const exportPlanButton = document.querySelector(
  '#export-plan',
) as HTMLButtonElement;
const sharePlanButton = document.querySelector(
  '#share-plan',
) as HTMLButtonElement;
const mapContainer = document.querySelector('#map-container') as HTMLElement;
const timelineToggle = document.querySelector('#timeline-toggle');
const mapOverlay = document.querySelector('#map-overlay') as HTMLElement;
const spinner = document.querySelector('#spinner') as HTMLElement;
const errorMessage = document.querySelector('#error-message') as HTMLElement;
const promptInput = document.querySelector(
  '#prompt-input',
) as HTMLTextAreaElement;



function initMap() {
  map = new ymaps.Map('map', {
    center: [55.751244, 37.618423], 
    zoom: 8, 
    controls: [], 
  });

  
  map.controls.add('zoomControl', {
    position: {
        right: 10,
        top: 70
    }
  });
}


if (typeof ymaps !== 'undefined') {
  ymaps.ready(initMap);
} else {
  
  console.error('Yandex Maps API not loaded.');
  errorMessage.textContent = 'Не удалось загрузить API Яндекс Карт.';
}



const locationFunctionDeclaration: FunctionDeclaration = {
  name: 'location',
  parameters: {
    type: Type.OBJECT,
    description: 'Geographic coordinates of a location.',
    properties: {
      name: {
        type: Type.STRING,
        description: 'Name of the location.',
      },
      description: {
        type: Type.STRING,
        description:
          'Description of the location: why is it relevant, details to know.',
      },
      lat: {
        type: Type.STRING,
        description: 'Latitude of the location.',
      },
      lng: {
        type: Type.STRING,
        description: 'Longitude of the location.',
      },
      time: {
        type: Type.STRING,
        description:
          'Time of day to visit this location (e.g., "09:00", "14:30").',
      },
      duration: {
        type: Type.STRING,
        description:
          'Suggested duration of stay at this location (e.g., "1 hour", "45 minutes").',
      },
      sequence: {
        type: Type.NUMBER,
        description: 'Order in the day itinerary (1 = first stop of the day).',
      },
    },
    required: ['name', 'description', 'lat', 'lng'],
  },
};


const lineFunctionDeclaration: FunctionDeclaration = {
  name: 'line',
  parameters: {
    type: Type.OBJECT,
    description: 'Connection between a start location and an end location.',
    properties: {
      name: {
        type: Type.STRING,
        description: 'Name of the route or connection',
      },
      start: {
        type: Type.OBJECT,
        description: 'Start location of the route',
        properties: {
          lat: {
            type: Type.STRING,
            description: 'Latitude of the start location.',
          },
          lng: {
            type: Type.STRING,
            description: 'Longitude of the start location.',
          },
        },
      },
      end: {
        type: Type.OBJECT,
        description: 'End location of the route',
        properties: {
          lat: {
            type: Type.STRING,
            description: 'Latitude of the end location.',
          },
          lng: {
            type: Type.STRING,
            description: 'Longitude of the end location.',
          },
        },
      },
      transport: {
        type: Type.STRING,
        description:
          'Mode of transportation between locations (e.g., "walking", "driving", "public transit").',
      },
      travelTime: {
        type: Type.STRING,
        description:
          'Estimated travel time between locations (e.g., "15 minutes", "1 hour").',
      },
    },
    required: ['name', 'start', 'end'],
  },
};


const systemInstructions = `## System Instructions for an Interactive Map Explorer

**Model Persona:** You are a knowledgeable, geographically-aware assistant that provides visual information through maps.
Your primary goal is to answer any location-related query comprehensively, using map-based visualizations.
You can process information about virtually any place, real or fictional, past, present, or future.

**Core Capabilities:**

1. **Geographic Knowledge:** You possess extensive knowledge of:
   * Global locations, landmarks, and attractions
   * Historical sites and their significance
   * Natural wonders and geography
   * Cultural points of interest
   * Travel routes and transportation options

2. **Two Operation Modes:**

   **A. General Explorer Mode** (Default when DAY_PLANNER_MODE is false):
   * Respond to any query by identifying relevant geographic locations
   * Show multiple points of interest related to the query
   * Provide rich descriptions for each location
   * Connect related locations with appropriate paths
   * Focus on information delivery rather than scheduling

   **B. Day Planner Mode** (When DAY_PLANNER_MODE is true):
   * Create detailed day itineraries with:
     * A logical sequence of locations to visit throughout a day (typically 4-6 major stops)
     * Specific times and realistic durations for each location visit
     * Travel routes between locations with appropriate transportation methods
     * A balanced schedule considering travel time, meal breaks, and visit durations
     * Each location must include a 'time' (e.g., "09:00") and 'duration' property
     * Each location must include a 'sequence' number (1, 2, 3, etc.) to indicate order
     * Each line connecting locations should include 'transport' and 'travelTime' properties

**Output Format:**

1. **General Explorer Mode:**
   * Use the "location" function for each relevant point of interest with name, description, lat, lng
   * Use the "line" function to connect related locations if appropriate
   * Provide as many interesting locations as possible (4-8 is ideal)
   * Ensure each location has a meaningful description

2. **Day Planner Mode:**
   * Use the "location" function for each stop with required time, duration, and sequence properties
   * Use the "line" function to connect stops with transport and travelTime properties
   * Structure the day in a logical sequence with realistic timing
   * Include specific details about what to do at each location

**Important Guidelines:**
* For ANY query, always provide geographic data through the location function
* If unsure about a specific location, use your best judgment to provide coordinates
* Never reply with just questions or requests for clarification
* Always attempt to map the information visually, even for complex or abstract queries
* For day plans, create realistic schedules that start no earlier than 8:00am and end by 9:00pm

Remember: In default mode, respond to ANY query by finding relevant locations to display on the map, even if not explicitly about travel or geography. In day planner mode, create structured day itineraries.`;


const ai = new GoogleGenAI({apiKey: process.env.API_KEY});


function showTimeline() {
  if (timelineContainer) {
    timelineContainer.style.display = 'block';
    setTimeout(() => {
      timelineContainer.classList.add('visible');
      if (window.innerWidth > 768) {
        mapContainer.classList.add('map-container-shifted');
        adjustMapBoundsWithDelay();
      } else {
        mapOverlay.classList.add('visible');
      }
    }, 10);
  }
}

function hideTimeline() {
  if (timelineContainer) {
    timelineContainer.classList.remove('visible');
    mapContainer.classList.remove('map-container-shifted');
    mapOverlay.classList.remove('visible');
    setTimeout(() => {
      timelineContainer.style.display = 'none';
      adjustMapBoundsWithDelay();
    }, 300);
  }
}

function adjustMapBoundsWithDelay() {
    if (map && allGeoPointsForBounds.length > 0) {
        setTimeout(() => {
            map.setBounds(ymaps.util.bounds.fromPoints(allGeoPointsForBounds), {
                checkZoomRange: true,
                duration: 300,
                zoomMargin: [20, 20, 20, 20] 
            });
        }, 350); 
    } else if (map) {
        
        map.setCenter(map.getCenter(), map.getZoom(), { duration: 300 });
    }
}



promptInput.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Enter' && !e.shiftKey) {
    generateButton.classList.add('loading');
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => {
      sendText(promptInput.value);
      promptInput.value = '';
    }, 10);
  }
});

generateButton.addEventListener('click', (e) => {
  const buttonEl = e.currentTarget as HTMLButtonElement;
  buttonEl.classList.add('loading');
  setTimeout(() => {
    sendText(promptInput.value);
  }, 10);
});

resetButton.addEventListener('click', () => {
  restart();
});

if (prevCardButton) {
  prevCardButton.addEventListener('click', () => {
    navigateCards(-1);
  });
}

if (nextCardButton) {
  nextCardButton.addEventListener('click', () => {
    navigateCards(1);
  });
}

if (plannerModeToggle) {
  plannerModeToggle.addEventListener('change', () => {
    isPlannerMode = plannerModeToggle.checked;
    promptInput.placeholder = isPlannerMode
      ? "Создайте план дня в... (например, 'План дня для прогулки по парку' или 'Один день в Париже')"
      : 'Исследуйте места, историю, события или маршруты...';
    if (!isPlannerMode && timelineContainer) {
      hideTimeline();
    }
  });
}

if (closeTimelineButton) {
  closeTimelineButton.addEventListener('click', () => {
    hideTimeline();
  });
}

if (timelineToggle) {
  timelineToggle.addEventListener('click', () => {
    showTimeline();
  });
}

if (mapOverlay) {
  mapOverlay.addEventListener('click', () => {
    hideTimeline();
  });
}

if (exportPlanButton) {
  exportPlanButton.addEventListener('click', () => {
    exportDayPlan();
  });
}

if (sharePlanButton) {
  sharePlanButton.addEventListener('click', () => {
    shareDayPlan();
  });
}


function restart() {
  allGeoPointsForBounds = [];
  dayPlanItinerary = [];
  locationDetails = [];

  if (map) {
    map.geoObjects.removeAll();
  }
  markers = [];
  lines = [];

  if (cardContainer) cardContainer.innerHTML = '';
  if (carouselIndicators) carouselIndicators.innerHTML = '';
  if (cardCarousel) cardCarousel.style.display = 'none';
  if (timelineEl) timelineEl.innerHTML = '';
  if (timelineContainer) hideTimeline();
  if (map) {
    map.setCenter([55.751244, 37.618423], 8); 
  }
}


async function sendText(prompt: string) {
  spinner.classList.remove('hidden');
  errorMessage.innerHTML = '';
  restart();

  try {
    let finalPrompt = prompt;
    if (isPlannerMode) {
      finalPrompt = prompt + ' day trip'; 
                                        
                                        
    }

    const updatedInstructions = isPlannerMode
      ? systemInstructions.replace('DAY_PLANNER_MODE', 'true')
      : systemInstructions.replace('DAY_PLANNER_MODE', 'false');

    const response = await ai.models.generateContentStream({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: finalPrompt,
      config: {
        systemInstruction: updatedInstructions,
        temperature: 1,
        tools: [
          {
            functionDeclarations: [
              locationFunctionDeclaration,
              lineFunctionDeclaration,
            ],
          },
        ],
      },
    });

    let text = '';
    let results = false;
    for await (const chunk of response) {
      const fns = chunk.functionCalls ?? [];
      for (const fn of fns) {
        if (fn.name === 'location') {
          setPin(fn.args);
          results = true;
        }
        if (fn.name === 'line') {
          setLeg(fn.args);
          results = true;
        }
      }

      
      text += chunk.text ?? '';
    }


    if (!results) {
      throw new Error(
        'Не удалось получить результаты. Попробуйте еще раз или измените запрос.',
      );
    }

    if (allGeoPointsForBounds.length > 0 && map) {
        map.setBounds(ymaps.util.bounds.fromPoints(allGeoPointsForBounds), {
            checkZoomRange: true,
            duration: 500,
            zoomMargin: [30, 30, 30, 30] 
        });
    }


    if (isPlannerMode && dayPlanItinerary.length > 0) {
      dayPlanItinerary.sort(
        (a, b) =>
          (a.sequence || Infinity) - (b.sequence || Infinity) ||
          (a.time || '').localeCompare(b.time || ''),
      );
      createTimeline();
      showTimeline();
    }

    createLocationCards();
  } catch (e: any) {
    errorMessage.innerHTML = e.message;
    console.error('Error generating content:', e);
  } finally {
    generateButton.classList.remove('loading');
    spinner.classList.add('hidden');
  }
}


function setPin(args: any) {
  const lat = Number(args.lat);
  const lng = Number(args.lng);
  const point: [number, number] = [lat, lng];
  allGeoPointsForBounds.push(point);

  let balloonContent = `<b>${args.name}</b><br/>${args.description}`;
  if (args.time) {
    balloonContent += `<div style="margin-top: 4px; font-size: 12px; color: #2196F3;">
                          <i class="fas fa-clock"></i> ${args.time}
                          ${args.duration ? ` • ${args.duration}` : ''}
                        </div>`;
  }

  const placemark = new ymaps.Placemark(point, {
    hintContent: args.name,
    balloonContentHeader: args.name,
    balloonContentBody: args.description + 
      (args.time ? `<br><small><i class="fas fa-clock"></i> ${args.time}${args.duration ? ` (${args.duration})` : ''}</small>` : ''),
    iconContent: isPlannerMode && args.sequence ? args.sequence : ''
  }, {
    preset: isPlannerMode ? (args.sequence ? 'islands#blueStretchyIcon' : 'islands#blueDotIcon') : 'islands#redDotIcon',
  });

  map.geoObjects.add(placemark);
  markers.push(placemark);

  const detail: LocationDetail = {
    name: args.name,
    description: args.description,
    lat: lat,
    lng: lng,
    placemark: placemark,
    time: args.time,
    duration: args.duration,
    sequence: args.sequence,
  };
  locationDetails.push(detail);

  if (isPlannerMode && (args.time || args.sequence)) { 
    dayPlanItinerary.push(detail);
  }
}


function setLeg(args: any) {
  const startCoords: [number, number] = [Number(args.start.lat), Number(args.start.lng)];
  const endCoords: [number, number] = [Number(args.end.lat), Number(args.end.lng)];
  allGeoPointsForBounds.push(startCoords);
  allGeoPointsForBounds.push(endCoords);

  const polyline = new ymaps.Polyline([startCoords, endCoords], {
    hintContent: args.name,
    balloonContent: args.name + 
        (args.transport ? `<br>Транспорт: ${args.transport}` : '') +
        (args.travelTime ? `<br>Время в пути: ${args.travelTime}` : '')
  }, {
    strokeColor: isPlannerMode ? '#2196F3' : '#CC0099',
    strokeWidth: isPlannerMode ? 4 : 3,
    strokeOpacity: 0.9,
    strokeStyle: isPlannerMode ? 'dash' : 'solid'
  });

  map.geoObjects.add(polyline);
  lines.push({
    polyline, 
    name: args.name,
    transport: args.transport,
    travelTime: args.travelTime,
    
    startLat: startCoords[0],
    startLng: startCoords[1],
    endLat: endCoords[0],
    endLng: endCoords[1],
  });
}


function createTimeline() {
  if (!timelineEl || dayPlanItinerary.length === 0) return;
  timelineEl.innerHTML = '';

  dayPlanItinerary.forEach((item, index) => {
    const timelineItem = document.createElement('div');
    timelineItem.className = 'timeline-item';
    const timeDisplay = item.time || 'Гибкое';

    timelineItem.innerHTML = `
      <div class="timeline-time">${timeDisplay}</div>
      <div class="timeline-connector">
        <div class="timeline-dot"></div>
        <div class="timeline-line"></div>
      </div>
      <div class="timeline-content" data-index="${index}" data-name="${item.name}">
        <div class="timeline-title">${item.name}</div>
        <div class="timeline-description">${item.description}</div>
        ${item.duration ? `<div class="timeline-duration">${item.duration}</div>` : ''}
      </div>
    `;

    const timelineContent = timelineItem.querySelector('.timeline-content');
    if (timelineContent) {
      timelineContent.addEventListener('click', () => {
        
        const detailIndex = locationDetails.findIndex(ld => ld.name === item.name && ld.lat === item.lat && ld.lng === item.lng);
        if (detailIndex !== -1) {
          highlightCard(detailIndex);
        }
      });
    }
    timelineEl.appendChild(timelineItem);
  });

  
  const timelineItems = timelineEl.querySelectorAll('.timeline-item'); 
    for (let i = 0; i < dayPlanItinerary.length - 1; i++) {
        const currentPlanItem = dayPlanItinerary[i];
        const nextPlanItem = dayPlanItinerary[i+1];

        
        const currentTimelineDOMItem = Array.from(timelineItems).find(ti => {
            const content = ti.querySelector('.timeline-content');
            return content && content.getAttribute('data-name') === currentPlanItem.name;
        });

        if (!currentTimelineDOMItem) continue;


        const connectingLine = lines.find(line => {
            
            
            
            const nameMatchesCurrent = line.name.includes(currentPlanItem.name);
            const nameMatchesNext = line.name.includes(nextPlanItem.name);
            
            const coordsMatch = (
                (Math.abs(line.startLat - currentPlanItem.lat) < 0.0001 && Math.abs(line.startLng - currentPlanItem.lng) < 0.0001 &&
                 Math.abs(line.endLat - nextPlanItem.lat) < 0.0001 && Math.abs(line.endLng - nextPlanItem.lng) < 0.0001) ||
                (Math.abs(line.startLat - nextPlanItem.lat) < 0.0001 && Math.abs(line.startLng - nextPlanItem.lng) < 0.0001 &&
                 Math.abs(line.endLat - currentPlanItem.lat) < 0.0001 && Math.abs(line.endLng - currentPlanItem.lng) < 0.0001)
            );

            return (nameMatchesCurrent && nameMatchesNext) || coordsMatch;
        });


        if (connectingLine && (connectingLine.transport || connectingLine.travelTime)) {
            const transportItem = document.createElement('div');
            transportItem.className = 'timeline-item transport-item';
            transportItem.innerHTML = `
              <div class="timeline-time"></div>
              <div class="timeline-connector">
                <div class="timeline-dot" style="background-color: #999;"></div>
                <div class="timeline-line"></div>
              </div>
              <div class="timeline-content transport">
                <div class="timeline-title">
                  <i class="fas fa-${getTransportIcon(connectingLine.transport || 'travel')}"></i>
                  ${connectingLine.transport || 'Поездка'}
                </div>
                <div class="timeline-description">${connectingLine.name}</div>
                ${connectingLine.travelTime ? `<div class="timeline-duration">${connectingLine.travelTime}</div>` : ''}
              </div>
            `;
            currentTimelineDOMItem.after(transportItem);
        }
    }
}



function getTransportIcon(transportType: string): string {
  const type = (transportType || '').toLowerCase();
  if (type.includes('walk') || type.includes('пешком')) {
    return 'walking';
  }
  if (type.includes('car') || type.includes('driv') || type.includes('авто')) {
    return 'car-side';
  }
  if (
    type.includes('bus') || type.includes('transit') || type.includes('public') || type.includes('автобус') || type.includes('обществен')
  ) {
    return 'bus-alt';
  }
  if (
    type.includes('train') || type.includes('subway') || type.includes('metro') || type.includes('поезд') || type.includes('метро')
  ) {
    return 'train';
  }
  if (type.includes('bike') || type.includes('cycl') || type.includes('велосипед')) {
    return 'bicycle';
  }
  if (type.includes('taxi') || type.includes('cab') || type.includes('такси')) {
    return 'taxi';
  }
  if (type.includes('boat') || type.includes('ferry') || type.includes('лодка') || type.includes('паром')) {
    return 'ship';
  }
  if (type.includes('plane') || type.includes('fly') || type.includes('самолет')) {
    return 'plane-departure';
  }
  {
    return 'route';
  } 
}


function getPlaceholderImage(locationName: string): string {
  let hash = 0;
  for (let i = 0; i < locationName.length; i++) {
    hash = locationName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  const saturation = 60 + (hash % 30);
  const lightness = 50 + (hash % 20);
  const letter = locationName.charAt(0).toUpperCase() || '?';

  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http:
      <rect width="300" height="180" fill="hsl(${hue}, ${saturation}%, ${lightness}%)" />
      <text x="150" y="95" font-family="Arial, sans-serif" font-size="72" fill="white" text-anchor="middle" dominant-baseline="middle">${letter}</text>
    </svg>
  `)}`;
}


function createLocationCards() {
  if (!cardContainer || !carouselIndicators || locationDetails.length === 0) {
    if (cardCarousel) cardCarousel.style.display = 'none';
    return;
  }
  cardContainer.innerHTML = '';
  carouselIndicators.innerHTML = '';

  locationDetails.forEach((location, index) => {
    const card = document.createElement('div');
    card.className = 'location-card';
    if (isPlannerMode && location.sequence) card.classList.add('day-planner-card');
    if (index === activeCardIndex) card.classList.add('card-active'); 

    const imageUrl = getPlaceholderImage(location.name);
    let cardContent = `<div class="card-image" style="background-image: url('${imageUrl}')"></div>`;

    if (isPlannerMode) {
      if (location.sequence) {
        cardContent += `<div class="card-sequence-badge">${location.sequence}</div>`;
      }
      if (location.time) {
        cardContent += `<div class="card-time-badge">${location.time}</div>`;
      }
    }

    cardContent += `
      <div class="card-content">
        <h3 class="card-title">${location.name}</h3>
        <p class="card-description">${location.description}</p>
        ${isPlannerMode && location.duration ? `<div class="card-duration">${location.duration}</div>` : ''}
        <div class="card-coordinates">
          ${location.lat.toFixed(5)}, ${location.lng.toFixed(5)}
        </div>
      </div>
    `;
    card.innerHTML = cardContent;

    card.addEventListener('click', () => {
      highlightCard(index);
    });

    cardContainer.appendChild(card);

    const dot = document.createElement('div');
    dot.className = 'carousel-dot';
    if (index === activeCardIndex) dot.classList.add('active');
    carouselIndicators.appendChild(dot);
  });

  if (cardCarousel) {
    cardCarousel.style.display = locationDetails.length > 0 ? 'block' : 'none';
  }
  
  if (locationDetails.length > 0) {
     highlightCard(activeCardIndex); 
  }
}


function highlightCard(index: number) {
  if (index < 0 || index >= locationDetails.length) return;
  activeCardIndex = index;
  const cards = cardContainer?.querySelectorAll('.location-card');
  if (!cards || !map) return;

  
  map.balloon.close();

  cards.forEach((card, i) => card.classList.toggle('card-active', i === index));
  
  if (cards[index]) {
    const cardWidth = (cards[index] as HTMLElement).offsetWidth;
    const containerWidth = cardContainer.offsetWidth;
    const scrollPosition =
      (cards[index] as HTMLElement).offsetLeft - containerWidth / 2 + cardWidth / 2;
    cardContainer.scrollTo({left: scrollPosition, behavior: 'smooth'});
  }

  const dots = carouselIndicators?.querySelectorAll('.carousel-dot');
  if (dots) {
    dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
  }

  const selectedLocation = locationDetails[index];
  if (selectedLocation && selectedLocation.placemark) {
    map.panTo(selectedLocation.placemark.geometry.getCoordinates(), {duration: 500}).then(() => {
        selectedLocation.placemark.balloon.open();
    });
  } else if (selectedLocation) { 
    map.panTo([selectedLocation.lat, selectedLocation.lng], {duration: 500});
  }


  if (isPlannerMode) highlightTimelineItemByLocation(selectedLocation);
}


function highlightTimelineItemByLocation(location: LocationDetail) {
  if (!timelineEl) return;
  const timelineContentItems = timelineEl.querySelectorAll(
    '.timeline-content:not(.transport)',
  );
  timelineContentItems.forEach((item) => item.classList.remove('active'));

  for (const item of timelineContentItems) {
    const title = item.querySelector('.timeline-title');
    
    const itemSequence = item.parentElement?.querySelector('.timeline-time')?.textContent === location.time || item.getAttribute('data-name') === location.name;

    if (title && title.textContent === location.name && (!location.sequence || itemSequence)) {
      item.classList.add('active');
      item.scrollIntoView({behavior: 'smooth', block: 'nearest'});
      break;
    }
  }
}



function navigateCards(direction: number) {
  const newIndex = activeCardIndex + direction;
  if (newIndex >= 0 && newIndex < locationDetails.length) {
    highlightCard(newIndex);
  }
}

function formatDayPlanText(forSharing: boolean = false): string {
  if (!dayPlanItinerary.length) return forSharing ? "План дня пуст." : "# План дня пуст\n";
  let content = forSharing ? "Ваш План Дня:\n\n" : "# Ваш План Дня\n\n";

  dayPlanItinerary.forEach((item, index) => {
    content += `${forSharing ? '' : '## '}${index + 1}. ${item.name}\n`;
    content += `Время: ${item.time || 'Гибкое'}\n`;
    if (item.duration) content += `Длительность: ${item.duration}\n`;
    content += `\n${item.description}\n\n`;

    if (index < dayPlanItinerary.length - 1) {
      const nextItem = dayPlanItinerary[index + 1];
       const connectingLine = lines.find(line => {
            const coordsMatch = (
                (Math.abs(line.startLat - item.lat) < 0.0001 && Math.abs(line.startLng - item.lng) < 0.0001 &&
                 Math.abs(line.endLat - nextItem.lat) < 0.0001 && Math.abs(line.endLng - nextItem.lng) < 0.0001) ||
                (Math.abs(line.startLat - nextItem.lat) < 0.0001 && Math.abs(line.startLng - nextItem.lng) < 0.0001 &&
                 Math.abs(line.endLat - item.lat) < 0.0001 && Math.abs(line.endLng - item.lng) < 0.0001)
            );
            return coordsMatch || (line.name.includes(item.name) && line.name.includes(nextItem.name));
        });

      if (connectingLine) {
        content += `${forSharing ? '' : '### '}Поездка к ${nextItem.name}\n`;
        content += `Способ: ${connectingLine.transport || 'Не указан'}\n`;
        if (connectingLine.travelTime) {
          content += `Время в пути: ${connectingLine.travelTime}\n`;
        }
        content += `\n`;
      }
    }
  });
  return content;
}



function exportDayPlan() {
  const content = formatDayPlanText(false);
  if (content.startsWith("# План дня пуст")) {
    alert("План дня пуст, нечего экспортировать.");
    return;
  }
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'план-дня.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


async function shareDayPlan() {
  const content = formatDayPlanText(true);
   if (content === "План дня пуст.") {
    alert("План дня пуст, нечего копировать.");
    return;
  }
  try {
    await navigator.clipboard.writeText(content);
    alert('План дня скопирован в буфер обмена!');
  } catch (err) {
    console.error('Не удалось скопировать текст: ', err);
    alert('Не удалось скопировать план. Пожалуйста, попробуйте вручную.');
  }
}
