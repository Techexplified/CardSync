import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../styles/global.css';
import { getTrelloInitOptions } from '../config/trello';
import { ModalApp } from './App';
import type { TrelloClient } from '../types/trello';

// iframe() MUST be called before any React rendering — Trello SDK initializes
// its internal Statsig client here and throws if called inside a render/useState.
const trelloClient: TrelloClient | null = window.TrelloPowerUp
  ? (window.TrelloPowerUp.iframe(getTrelloInitOptions()) as TrelloClient)
  : null;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalApp trelloClient={trelloClient} />
  </StrictMode>
);

