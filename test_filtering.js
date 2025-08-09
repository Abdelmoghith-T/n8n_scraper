const GoogleMapsScraper = require('./scraper');

// Test data with business names and comments mixed together
const testNames = [
    // Valid business names (various patterns)
    "Webmarko", // Simple name
    "Agence Digital Fes", // Contains business keywords
    "Création Web Solutions", // Contains business keywords
    "Studio Design Pro", // Contains business keywords
    "Tech Innovation SARL", // Contains business keywords
    "NewDev Maroc", // CamelCase + location
    "123 Solutions", // Starts with number
    "e-Marketing", // Starts with lowercase
    "SARL ABC", // All caps with business type
    "WebDev", // CamelCase
    "InfoSoft", // Contains business keywords
    "DataNet", // Contains business keywords
    "SmartAuto", // Contains business keywords
    "ABC", // Short acronym
    "XYZ Corp", // Acronym + business type
    
    // Comments and reviews that should be filtered out
    "très bon service",
    "je recommande vivement",
    "excellent travail",
    "super bien fait",
    "nous avons été satisfaits",
    "il y a 2 mois",
    "parfait pour nos besoins",
    "service client impeccable",
    "prix très raisonnable",
    "équipe très professionnelle",
    "merci beaucoup",
    "bonjour à tous",
    "vraiment content du résultat",
    "problème résolu rapidement",
    "avis très positif",
    "hier nous avons testé",
    "depuis 3 ans",
    "mais c'est bien",
    "cependant il faut noter",
    "je suis très satisfait",
    "nous recommandons cette agence",
    "excellent service après-vente",
    "rapide et efficace",
    "personnel très accueillant",
    "tarif compétitif",
    
    // More valid business names
    "Media Plus Maroc",
    "Inventis",
    "Screenday",
    "Creative Labs",

    // UI elements and ratings that should be filtered out
    "Developer.ma  5,0(12)Concepteur de sites Web0777-385753",
    "Rendez-vous en ligne",
    "Voir plus d'infos",
    "Appeler maintenant",
    "Site officiel",
    "Horaires d'ouverture",
    "Itinéraire vers",
    "Ouvrir maintenant",
    "4,5(123) Excellent service",
    "\"Très bon travail\"",
    "«Super agence»"
];

async function testFiltering() {
    console.log('🧪 Testing business name filtering...');
    console.log('=====================================');
    
    const scraper = new GoogleMapsScraper();
    
    // Simulate the filtering logic from extractBusinessNames
    const validBusinessNames = testNames.filter(name => {
        // Apply the same validation logic as in the scraper
        return name &&
            name.length >= 3 &&
            name.length <= 80 &&
            // Must not be a sentence or comment
            !name.match(/^(je|j'|nous|vous|ils|elles|on|il|elle|tu)\s+/i) &&
            !name.match(/\s+(est|était|sera|serait|a|avait|aura|sont|étaient)\s+/i) &&
            !name.match(/^(très|super|excellent|parfait|génial|bien|mal|mauvais|nul)\s+/i) &&
            !name.match(/^(merci|thanks|bravo|félicitations)\s+/i) &&
            !name.match(/^(bonjour|bonsoir|salut|hello|hi|bye)\s+/i) &&
            !name.match(/^(recommande|conseille|déconseille|éviter)\s+/i) &&
            !name.match(/^(service|accueil|personnel|équipe|staff|client)\s+/i) &&
            !name.match(/^(prix|tarif|coût|cher|gratuit|payant)\s+/i) &&
            !name.match(/^(rapide|lent|long|court|vite)\s+/i) &&
            !name.match(/^(problème|souci|bug|erreur|panne)\s+/i) &&
            !name.match(/^(avis|commentaire|review|opinion)\s+/i) &&
            !name.match(/^(hier|aujourd'hui|demain|maintenant)\s+/i) &&
            !name.match(/^(depuis|pendant|durant|après|avant)\s+/i) &&
            !name.match(/^(mais|cependant|néanmoins|toutefois)\s+/i) &&
            !name.match(/^(vraiment|assez|très|trop|plutôt)\s+/i) &&
            // Must not contain typical review phrases
            !name.includes('il y a') &&
            !name.includes('j\'ai') &&
            !name.includes('nous avons') &&
            !name.includes('je recommande') &&
            !name.includes('très bien') &&
            !name.includes('pas mal') &&
            !name.includes('super bien') &&
            !name.includes('excellent service') &&
            // Must not be a time expression
            !name.match(/^\d+\s*(ans?|mois|jours?|heures?|minutes?|semaines?)/i) &&
            !name.match(/il y a \d+/i) &&
            // Must not be Google Maps UI elements or ratings
            !name.match(/\d+[,\.]\d+\(\d+\)/i) && // Ratings like "5,0(12)"
            !name.match(/.*\s+\d+[,\.]\d+\(\d+\).*\d{4}-\d{6}/i) && // Complex UI strings with ratings and phone numbers
            !name.match(/^(rendez-vous|appointment|booking|réservation)\s+(en\s+ligne|online)/i) && // Generic booking UI
            !name.match(/^(voir|view|show|afficher)\s+(plus|more|tout|all)/i) && // "View more" type UI elements
            !name.match(/^(ouvrir|open|fermer|close)\s+(maintenant|now|bientôt|soon)/i) && // Open/close status
            !name.match(/^(horaires?|hours?|schedule)\s+(d'ouverture|opening)/i) && // Opening hours
            !name.match(/^(itinéraire|directions?|route)\s+(vers|to)/i) && // Directions UI
            !name.match(/^(appeler|call|téléphoner)\s+(maintenant|now)/i) && // Call now buttons
            !name.match(/^(site|website|web)\s+(officiel|official)/i) && // Official website links
            !name.match(/^(plus\s+d'infos?|more\s+info|en\s+savoir\s+plus)/i) && // More info links
            // Must not contain quotes (often indicates reviews)
            !name.includes('"') &&
            !name.includes('"') &&
            !name.includes('"') &&
            !name.includes('«') &&
            !name.includes('»') &&
            // Should look like a business name - much more permissive validation
            (
                // Basic business name patterns (more flexible)
                name.match(/^[A-Za-z0-9][A-Za-z0-9\s&\-\.]{2,}$/) || // Alphanumeric start, reasonable characters
                name.match(/^[A-Z]{2,}$/) || // All caps (like acronyms)
                name.match(/[A-Z][a-z]+[A-Z]/) || // CamelCase

                // Contains business-like words (expanded list)
                name.includes('Agence') || name.includes('Digital') || name.includes('Web') ||
                name.includes('Marketing') || name.includes('Création') || name.includes('Développement') ||
                name.includes('Technologies') || name.includes('Solutions') || name.includes('Services') ||
                name.includes('Studio') || name.includes('Design') || name.includes('Media') ||
                name.includes('Communication') || name.includes('Consulting') || name.includes('Conseil') ||
                name.includes('SARL') || name.includes('SAS') || name.includes('SA') || name.includes('EURL') ||
                name.includes('Société') || name.includes('Company') || name.includes('Corp') ||
                name.includes('Ltd') || name.includes('Group') || name.includes('Groupe') ||
                name.includes('Center') || name.includes('Centre') || name.includes('Lab') ||
                name.includes('Labs') || name.includes('Tech') || name.includes('IT') ||
                name.includes('Software') || name.includes('App') || name.includes('Code') ||
                name.includes('Dev') || name.includes('Pro') || name.includes('Plus') ||
                name.includes('Max') || name.includes('Elite') || name.includes('Premium') ||
                name.includes('Expert') || name.includes('Master') || name.includes('Creative') ||
                name.includes('Innovation') || name.includes('Network') || name.includes('System') ||
                name.includes('Global') || name.includes('International') || name.includes('Maroc') ||
                name.includes('Morocco') || name.includes('Fes') || name.includes('Fès') ||

                // Additional business indicators
                name.includes('Info') || name.includes('Data') || name.includes('Soft') ||
                name.includes('Net') || name.includes('Online') || name.includes('Digital') ||
                name.includes('Cyber') || name.includes('Cloud') || name.includes('Smart') ||
                name.includes('Auto') || name.includes('Mobile') || name.includes('Print') ||
                name.includes('Photo') || name.includes('Video') || name.includes('Audio') ||
                name.includes('Event') || name.includes('Trade') || name.includes('Business') ||
                name.includes('Commercial') || name.includes('Industrial') || name.includes('Retail')
            );
    });
    
    console.log(`📊 Original test data: ${testNames.length} entries`);
    console.log(`✅ Valid business names: ${validBusinessNames.length} entries`);
    console.log(`❌ Filtered out: ${testNames.length - validBusinessNames.length} entries`);
    
    console.log('\n✅ VALID BUSINESS NAMES:');
    console.log('========================');
    validBusinessNames.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
    });
    
    console.log('\n❌ FILTERED OUT (Comments/Reviews):');
    console.log('===================================');
    const filteredOut = testNames.filter(name => !validBusinessNames.includes(name));
    filteredOut.forEach((name, index) => {
        console.log(`${index + 1}. ${name}`);
    });
    
    console.log('\n🎉 Filtering test completed!');
    console.log(`Success rate: ${Math.round((validBusinessNames.length / (validBusinessNames.length + filteredOut.length)) * 100)}% valid business names retained`);
}

testFiltering().catch(console.error);
