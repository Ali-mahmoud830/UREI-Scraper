import sys
sys.path.append('backend')
from main import SemanticQueryParser

prompt = "Search for all listings tagged with 'Building for rent' or 'Commercial property' in Downtown, Dokki, Giza, or Zamalek with total area > 3000 sqm or floors > 5."
print("TESTING PROMPT:")
print(prompt)
print("\nPARSED OUTPUT:")
print(SemanticQueryParser.parse(prompt))
