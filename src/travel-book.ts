import { placeInfo, placePhoto, wikipediaLink } from './place-info';
import { activityCatalogue, type TaskId } from './activity-catalogue';
import { places, distance, memoryNames } from './data';
import { t } from './i18n';
import { bindPress } from './touch-controls';
import type { Game } from './game';

/** The same selected place survives switching pages and activity views. */
export class TravelBook {
  selected = 'serranos';
  tab = 'places';
  filter = 'place';
  constructor(private game: Game, private close: ()=>void) {}
  open(root: HTMLElement, current = true) {
    if(current)this.selected=this.game.currentPlace()?.id??this.selected;
    const g=this.game,p=places.find(p=>p.id===this.selected)!;
    const eligible=activityCatalogue.filter(task => this.filter==='all' || this.filter==='nearby' || (task.places as readonly string[]).includes(p.id));
    const list=this.filter==='nearby' ? [...eligible].sort((a,b)=>distance(g,g.interactions.destination(a.id)??g)-distance(g,g.interactions.destination(b.id)??g)) : eligible;
    root.innerHTML=`<div class="book-heading"><small>VALÈNCIA · ${t('Travel journal')}</small><h2>${t('Book')}</h2><p>${g.visited.size}/11 ${t('Places')} · ${g.state.activities.completed.length}/8 ${t('Things to do')}</p></div>
      <div class="book-tabs" role="tablist">${['places','tasks'].map((id,i)=>`<button role="tab" id="book-tab-${id}" aria-controls="book-${id}" aria-selected="${this.tab===id}" data-tab="${id}">${t(i?'Things to do':'Places')}</button>`).join('')}</div>
      <div class="book-pages" data-tab="${this.tab}"><section id="book-places" class="book-page places-page" aria-labelledby="book-tab-places"><h3>${t('Places')}</h3><nav class="book-place-list">${places.map(place=>`<button data-book-place="${place.id}" aria-pressed="${place.id===p.id}"><span>${g.visited.has(place.id)?'✓':'○'}</span>${place.short}</button>`).join('')}</nav>
      <div class="book-place-detail">${placePhoto(p.id,p.name)}<h3>${p.name}</h3><p>${placeInfo(p.id).text}</p>${wikipediaLink(p.id)}</div></section>
      <section id="book-tasks" class="book-page tasks-page" aria-labelledby="book-tab-tasks"><h3>${t('Things to do')}</h3><div class="book-filters">${['place','all','nearby'].map((f,i)=>`<button data-filter="${f}" aria-pressed="${this.filter===f}">${i===0?p.short:t(i===1?'All activities':'Nearby')}</button>`).join('')}</div>
      ${list.map(task=>{const n=g.state.activities.progress[task.id],done=g.state.activities.completed.includes(task.id);return `<article class="book-task" data-task="${task.id}"><div class="task-status">${done?'✓':task.symbol} <small>${t(done?'Done':n>0?'In progress':'To do')}</small></div><h4>${t(task.name)}</h4><p>${t(task.description)}</p><small>${this.filter==='nearby'?Math.round(distance(g,g.interactions.destination(task.id)??g))+' m · ':''}${task.id==='oranges'?t('Orange grove')+' · ':''}${(this.filter==='place'?[p.short]:task.places.map(id=>places.find(p=>p.id===id)!.short).slice(0,3)).join(' · ')}</small><div class="task-meter"><progress max="${task.target}" value="${n}" aria-label="${t(task.name)}"></progress><span>${Math.floor(n)}/${task.target} ${task.unit}</span></div><button class="paper-btn" data-task-route="${task.id}">${g.trackedActivity===task.id?t('Stop tracking'):t('Show the way')}</button></article>`;}).join('')}
      <details class="book-memories"><summary>${t('Small memories')}</summary><p>${g.state.bikeTrip?'✓':'○'} ${t('Bike ride')} · ${g.state.tramTrip?'✓':'○'} ${t('Tram trip')}</p>${Object.entries(memoryNames).map(([id,name])=>`<p>${g.state.memories.includes(id as keyof typeof memoryNames)?'✓':'○'} ${t(name)}</p>`).join('')}</details></section></div>`;
    root.querySelectorAll<HTMLButtonElement>('[data-book-place]').forEach(b=>bindPress(b,()=>{this.selected=b.dataset.bookPlace!;this.filter='place';this.open(root,false);}));
    root.querySelectorAll<HTMLButtonElement>('[data-tab]').forEach(b=>bindPress(b,()=>{this.tab=b.dataset.tab!;root.querySelector<HTMLElement>('.book-pages')!.dataset.tab=this.tab;root.querySelectorAll<HTMLElement>('[data-tab]').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.tab===this.tab)));}));
    root.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach(b=>bindPress(b,()=>{this.filter=b.dataset.filter!;this.open(root,false);}));
    root.querySelectorAll<HTMLButtonElement>('[data-task-route]').forEach(b=>bindPress(b,()=>{const id=b.dataset.taskRoute as TaskId;g.trackedActivity=g.trackedActivity===id?null:id;g.waypoint=null;this.close();}));
  }
}
