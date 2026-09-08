import { assetUrl } from "./public-assets";
import { getLanguage } from './i18n';
import photos from './place-photos.json';

// Short, original summaries of the linked articles. Keep game instructions out
// of these cards: they describe the real places that inspired the world.
const descriptions: Record<keyof typeof photos, [string,string,string]> = {
  serranos: [
    'The Serranos Towers formed one of the gates in Valencia’s medieval city wall. Built in the late 14th century, the two towers are a fine example of Valencian Gothic architecture.',
    'Las Torres de Serranos formaban una de las puertas de la muralla medieval de Valencia. Construidas a finales del siglo XIV, sus dos torres son un ejemplo del gótico valenciano.',
    'Les Torres dels Serrans formaven una de les portes de la muralla medieval de València. Construïdes a finals del segle XIV, les dos torres són un exemple del gòtic valencià.'
  ],
  oldtown: [
    'Ciutat Vella is Valencia’s historic centre. Its six neighbourhoods include La Seu, El Carme and El Mercat, where narrow streets connect old churches, markets and public squares.',
    'Ciutat Vella es el centro histórico de Valencia. Sus seis barrios incluyen La Seu, El Carmen y El Mercat, donde calles estrechas unen iglesias, mercados y plazas.',
    'Ciutat Vella és el centre històric de València. Els seus sis barris inclouen la Seu, el Carme i el Mercat, on carrers estrets unixen esglésies, mercats i places.'
  ],
  townhall: [
    'The city hall faces one of Valencia’s main squares. Much of the surrounding architecture dates from the first half of the 20th century. A circular fountain marks the open space at its centre.',
    'El Ayuntamiento preside una de las principales plazas de Valencia. Gran parte de los edificios que la rodean son de la primera mitad del siglo XX. Una fuente circular ocupa el espacio central.',
    'L’Ajuntament presidix una de les places principals de València. Gran part dels edificis que l’envolten són de la primera mitat del segle XX. Una font circular ocupa l’espai central.'
  ],
  station: [
    'Estació del Nord is a railway station in the centre of Valencia, beside the bullring. Its decorated façade and main hall make it one of the city’s best-known examples of early 20th-century architecture.',
    'La Estació del Nord es una estación de tren situada en el centro de Valencia, junto a la plaza de toros. Su fachada decorada y su vestíbulo la convierten en un edificio destacado de principios del siglo XX.',
    'L’Estació del Nord és una estació de tren al centre de València, al costat de la plaça de bous. La façana decorada i el vestíbul la convertixen en un edifici destacat de principis del segle XX.'
  ],
  bullring: [
    'Built between 1850 and 1859, Valencia’s bullring was designed by Sebastián Monleón. Its shape draws on Roman arenas, with repeated rows of arches around a 48-sided structure.',
    'La plaza de toros de Valencia se construyó entre 1850 y 1859 según el diseño de Sebastián Monleón. Su forma se inspira en las arenas romanas, con filas de arcos alrededor de una estructura de 48 lados.',
    'La plaça de bous de València es va construir entre 1850 i 1859 segons el disseny de Sebastián Monleón. La forma s’inspira en les arenes romanes, amb files d’arcs al voltant d’una estructura de 48 costats.'
  ],
  science: [
    'The City of Arts and Sciences brings culture, science and entertainment together in a group of modern buildings. The eye-shaped Hemisfèric stands beside reflecting pools and the science museum.',
    'La Ciutat de les Arts i les Ciències reúne cultura, ciencia y ocio en un conjunto de edificios modernos. El Hemisfèric, con forma de ojo, se alza junto a los estanques y el museo de ciencias.',
    'La Ciutat de les Arts i les Ciències reunix cultura, ciència i oci en un conjunt d’edificis moderns. L’Hemisfèric, amb forma d’ull, s’alça al costat dels estanys i el museu de ciències.'
  ],
  aqua: [
    'Aqua Multiespacio is part of Valencia’s modern skyline. Completed in 2006, its office tower has 22 floors and reaches a height of 95 metres.',
    'Aqua Multiespacio forma parte del paisaje moderno de Valencia. Su torre de oficinas, terminada en 2006, tiene 22 plantas y alcanza los 95 metros de altura.',
    'Aqua Multiespacio forma part del paisatge modern de València. La torre d’oficines, acabada en 2006, té 22 plantes i arriba als 95 metres d’altura.'
  ],
  beach: [
    'La Devesa del Saler is a Mediterranean forest between L’Albufera and the sea. Its dunes and woodland form part of the natural park, protected together with the lagoon since 1986.',
    'La Devesa del Saler es un bosque mediterráneo situado entre L’Albufera y el mar. Sus dunas y su bosque forman parte del parque natural, protegido junto con la laguna desde 1986.',
    'La Devesa del Saler és un bosc mediterrani situat entre l’Albufera i la mar. Les dunes i el bosc formen part del parc natural, protegit junt amb la llacuna des de 1986.'
  ],
  university: [
    'La Nau is the historic home of the University of Valencia. The building dates from 1497 and was remodelled in 1830. Today its courtyard and rooms also host cultural exhibitions.',
    'La Nau es la sede histórica de la Universitat de València. El edificio data de 1497 y se reformó en 1830. Hoy su patio y sus salas también acogen exposiciones culturales.',
    'La Nau és la seu històrica de la Universitat de València. L’edifici data de 1497 i es va reformar en 1830. Hui el pati i les sales també acullen exposicions culturals.'
  ],
  albufera: [
    'L’Albufera is a freshwater lagoon on the coast south of Valencia. It forms the heart of a natural park where wetlands, canals and coastal dunes support many kinds of birds, fish and plants.',
    'L’Albufera es una laguna de agua dulce situada en la costa al sur de Valencia. Es el corazón de un parque natural donde humedales, canales y dunas albergan numerosas aves, peces y plantas.',
    'L’Albufera és una llacuna d’aigua dolça situada en la costa al sud de València. És el cor d’un parc natural on aiguamolls, canals i dunes acullen nombroses aus, peixos i plantes.'
  ],
  turia: [
    'The Turia Garden follows the former river bed through Valencia. This long public park gives the city a continuous green space, with paths and gardens passing beneath its historic bridges.',
    'El Jardín del Turia recorre el antiguo cauce del río a su paso por Valencia. Este largo parque público ofrece un espacio verde continuo, con caminos y jardines bajo sus puentes históricos.',
    'El Jardí del Túria recorre l’antic llit del riu al seu pas per València. Este llarg parc públic oferix un espai verd continu, amb camins i jardins davall dels ponts històrics.'
  ]
};
export function placeInfo(id: string) {
  const key=id as keyof typeof photos;
  const language=getLanguage();
  return {...photos[key],text:descriptions[key][language==='en'?0:language==='es'?1:2]};
}
export function placePhoto(id:string, name:string) {
  const info=placeInfo(id);
  return `<figure class="place-photo"><img src="${assetUrl(info.image)}" alt="${name}" width="960" height="640"/><figcaption><a href="${info.source}" target="_blank" rel="noopener noreferrer">${info.credit} · ${info.license}</a></figcaption></figure>`;
}
export function wikipediaLink(id:string) {
  return `<a class="wikipedia-link" href="${placeInfo(id).wiki}" target="_blank" rel="noopener noreferrer">Wikipedia ↗</a>`;
}
