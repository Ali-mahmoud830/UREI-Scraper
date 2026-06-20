export const en = {
  translation: {
    common: {
      loading: "Loading...",
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
      edit: "Edit",
      submit: "Submit",
      all: "All",
      none: "None"
    },
    nav: {
      dashboard: "Dashboard",
      leads: "Live Leads",
      admin: "Admin Settings",
      upload: "Upload Property",
      lang: "EN",
      switchLang: "عربي"
    },
    scraper: {
      title: "Scraper Control Panel",
      start: "Start Scraping Engine",
      stop: "Stop Scraper",
      isScraping: "Scraper is currently active...",
      aiPrompt: "AI Prompt",
      aiPromptPlaceholder: "e.g., I want warehouses in Moqattam for sale between 1M and 5M",
      manualMode: "Manual Mode",
      city: "City",
      cityPlaceholder: "Select cities...",
      category: "Asset Class",
      allCategories: "All Categories",
      categories: {
        apartment: "Apartment",
        villa: "Villa",
        commercial: "Commercial",
        warehouse: "Warehouse",
        hotel: "Hotel",
        land: "Land"
      },
      intent: "Transaction Intent",
      intents: {
        both: "Sale & Rent",
        sale: "For Sale",
        rent: "For Rent"
      },
      target: "Target Audience",
      targets: {
        buyers: "Buyers / Tenants",
        sellers: "Sellers / Landlords"
      },
      priceMin: "Min Price",
      priceMax: "Max Price",
      timeFilter: "Time Filter",
      timeFilters: {
        "24h": "Last 24 Hours",
        "7d": "Last 7 Days",
        "1m": "Last 30 Days",
        "all": "All Time"
      },
      sources: "Data Sources",
      toast: {
        starting: "Initializing Scraping Engine...",
        started: "Scraping session has been initiated successfully.",
        stopped: "Scraping engine halted."
      }
    },
    dashboard: {
      welcome: "Welcome back",
      totalLeads: "Total Leads",
      avgPrice: "Avg Lead Price",
      successRate: "Success Rate",
      activeSessions: "Active Sessions",
      recentActivity: "Recent Activity",
      sessionComplete: "Session Complete",
      sessionDesc: "Scraping session finished. Found {{count}} leads.",
      noSessions: "No active sessions found.",
      charts: {
        leadsByDay: "Leads by Day",
        leadsBySource: "Leads by Source"
      }
    },
    feed: {
      title: "Intelligence Feed",
      empty: "No matching assets found",
      waiting: "Waiting for Scraper to return results...",
      price: "Price",
      area: "Area",
      rooms: "Rooms",
      floor: "Floor",
      seller: "Seller",
      buyer: "Buyer",
      contact: "Contact",
      viewSource: "View Source",
      whatsapp: "WhatsApp",
      details: "Property Details"
    },
    admin: {
      title: "Admin Control Center",
      users: "User Management",
      system: "System Config",
      proxy: "Proxy Settings",
      logs: "System Logs",
      addUser: "Add New User",
      email: "Email Address",
      role: "Role",
      roles: {
        admin: "Administrator",
        agent: "Agent",
        viewer: "Viewer"
      },
      status: "Status",
      actions: "Actions",
      saveConfig: "Save Configuration",
      toast: {
        saved: "Configuration updated successfully",
        error: "Failed to update configuration"
      }
    },
    upload: {
      title: "Upload Asset",
      propertyType: "Property Type",
      location: "Location",
      description: "Description",
      multiFloor: "Multi-Floor / Penthouse Configuration",
      addFloor: "Add Floor",
      floorName: "Floor Name",
      floorArea: "Floor Area",
      floorFeatures: "Floor Features",
      uploadImages: "Upload Media",
      submit: "Publish Asset",
      toast: {
        success: "Asset published successfully",
        error: "Failed to publish asset"
      }
    }
  }
};
