import { Scrappers } from './modules/scrappers/scrappers.js';

const INTERVAL_MS: number = 10000 // 10s
const legoOffersScrapper: Scrappers = new Scrappers()

// Start scrapping
setInterval(legoOffersScrapper.performPirceCheck, INTERVAL_MS)

