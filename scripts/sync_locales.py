import json

base_locale = "locales/uk.json"
target_locales = ["locales/en.json", "locales/ru.json", "locales/de.json"]

with open(base_locale, "r") as f:
    uk_keys = json.load(f)

for target in target_locales:
    with open(target, "r") as f:
        target_keys = json.load(f)
    
    # Add missing keys using UK values as fallback
    for k, v in uk_keys.items():
        if k not in target_keys:
            target_keys[k] = v
            
    with open(target, "w") as f:
        json.dump(target_keys, f, ensure_ascii=False, indent=2)

print("Locales synced successfully.")
