import { createContext } from 'react';

/** When true, pages render without outer AppLayout (Kissflow custom components / MemoryRouter shell). */
export const ProjectTrackerEmbedContext = createContext({ embed: false });
