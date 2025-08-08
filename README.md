# Google Maps Business Scraper

A Node.js scraper that extracts business information from Google Maps, converted from an n8n workflow. This tool searches for businesses and collects their names, phone numbers, websites, and email addresses.

## Features

- 🗺️ **Google Maps Scraping**: Searches Google Maps for businesses
- 👥 **Business Names**: Extracts business names using advanced regex patterns
- 📞 **Phone Numbers**: Finds Moroccan phone numbers (+212, 05xx, 06xx, 07xx formats)
- 🌐 **Website URLs**: Discovers business websites
- 📧 **Email Extraction**: Visits websites to find email addresses
- 🔄 **Data Processing**: Removes duplicates and filters unwanted data
- 📊 **Multiple Formats**: Saves results in both JSON and CSV formats

## Installation

1. Clone or download this repository
2. Install dependencies:
```bash
npm install
```

## Usage

### Basic Usage

```bash
# Run with default search (Web designers in Fes)
npm start

# Or use the runner script
npm run scrape

# Search for specific businesses
node run.js "restaurants in Paris"
node run.js "dentists in New York"
```

### Advanced Usage

```bash
# Show browser window (useful for debugging)
HEADLESS=false node run.js "web designers in Fes"

# Custom delay between requests
DELAY=2000 node run.js "hotels in Morocco"

# Custom output filename
OUTPUT_FILE=my_results.json node run.js "cafes in Casablanca"
```

### Environment Variables

- `HEADLESS=false` - Show browser window (default: true)
- `DELAY=2000` - Delay between requests in milliseconds (default: 1000)
- `OUTPUT_FILE=filename.json` - Custom output filename

## Output

The scraper generates two files:

### JSON Output (`google_maps_results.json`)
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "searchQuery": "Concepteur de sites Web fes",
  "totalResults": 15,
  "results": [
    {
      "name": "Web Design Company",
      "number": "+212 5 35 12 34 56",
      "emails": ["contact@webdesign.ma", "info@webdesign.ma"],
      "website": "https://webdesign.ma"
    }
  ]
}
```

### CSV Output (`google_maps_results.csv`)
```csv
Name,Phone Number,Emails,Website
"Web Design Company","+212 5 35 12 34 56","contact@webdesign.ma; info@webdesign.ma","https://webdesign.ma"
```

## How It Works

1. **Google Maps Search**: Navigates to Google Maps with your search query
2. **Data Extraction**: Uses regex patterns to extract:
   - Business names from structured data
   - Moroccan phone numbers
   - Website URLs from map data
3. **Website Scraping**: Visits each business website to find email addresses
4. **Data Processing**: 
   - Removes duplicates
   - Filters out social media links
   - Matches names with corresponding contact information
5. **Output Generation**: Saves results in JSON and CSV formats

## Configuration

You can modify the scraper behavior by editing the configuration in `run.js` or `scraper.js`:

```javascript
const config = {
    searchQuery: 'Your search query',
    headless: true,           // Set to false to see browser
    delay: 1000,             // Delay between requests (ms)
    outputFile: 'results.json'
};
```

## Error Handling

The scraper includes robust error handling:
- Continues if individual websites fail to load
- Handles network timeouts gracefully
- Logs detailed error information
- Saves partial results even if some steps fail

## Legal Considerations

- This tool is for educational and research purposes
- Respect robots.txt and website terms of service
- Consider rate limiting to avoid overwhelming servers
- Be mindful of data privacy regulations

## Troubleshooting

### Common Issues

1. **Browser won't start**: Try running with `HEADLESS=false` to see what's happening
2. **No results found**: Check if your search query returns results on Google Maps manually
3. **Timeout errors**: Increase the delay with `DELAY=3000`
4. **Permission errors**: Make sure you have write permissions in the directory

### Debug Mode

Run with visible browser to debug:
```bash
HEADLESS=false node run.js "your search query"
```

## Dependencies

- **puppeteer**: Web scraping and browser automation
- **fs**: File system operations (built-in Node.js module)

## License

ISC License - Feel free to modify and use for your projects.
