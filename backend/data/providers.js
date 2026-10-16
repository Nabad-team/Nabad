// Curated published information checked 2026-10-15. Not live service availability.
// Coordinates and addresses: MoPH locator. Capabilities: linked hospital/MoPH/partner sources.
// Missing services and null emergency status mean unverified, never unavailable.
module.exports = [
  {
    "slug": "aubmc",
    "name": "American University of Beirut Medical Center",
    "type": "hospital",
    "city": "Beirut",
    "address": "Hamra, Cairo Street",
    "latitude": 33.89812,
    "longitude": 35.48538,
    "phone": "+9611350000",
    "specialties": [
      "emergency-medicine"
    ],
    "emergency24h": true,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.aubmc.org.lb/patientcare/Pages/pat_info.aspx"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "governorate": "Beirut",
    "services": []
  },
  {
    "slug": "lau-rizk",
    "name": "LAU Medical Center – Rizk Hospital",
    "type": "hospital",
    "city": "Beirut",
    "address": "Zahar Street, Achrafieh",
    "latitude": 33.88554,
    "longitude": 35.51449,
    "phone": "+9611200800",
    "specialties": [
      "emergency-medicine",
      "pediatrics",
      "dermatology",
      "neurology",
      "ophthalmology",
      "internal-medicine",
      "obstetrics-gynecology",
      "orthopedics"
    ],
    "emergency24h": true,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.laumcrh.com/contact-us",
      "https://www.laumcrh.com/departments/medical-departments",
      "https://www.laumcrh.com/departments/medical-departments/internal-medicine/emergency-department"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "governorate": "Beirut",
    "services": []
  },
  {
    "slug": "nini-hospital",
    "name": "Nini Hospital",
    "type": "hospital",
    "city": "Tripoli",
    "address": "Maarad Street",
    "latitude": 34.43587,
    "longitude": 35.83076,
    "specialties": [
      "cardiology",
      "internal-medicine",
      "surgery",
      "obstetrics-gynecology",
      "pediatrics",
      "radiology"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.hopitalnini.com/en/component/jecontact/",
      "https://www.hopitalnini.com/en/departments/2-uncategorised"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "governorate": "North",
    "services": [
      "mri",
      "maternity"
    ],
    "phone": "+9616431400"
  },
  {
    "slug": "hammoud-hospital",
    "name": "Hammoud Hospital University Medical Center",
    "type": "hospital",
    "city": "Saida",
    "address": "Skandarani, Dr. Ghassan Hammoud Street",
    "latitude": 33.56025,
    "longitude": 35.37551,
    "specialties": [
      "cardiology",
      "emergency-medicine",
      "family-medicine",
      "nephrology",
      "neurology",
      "obstetrics-gynecology",
      "ophthalmology",
      "pediatrics",
      "radiology",
      "surgery",
      "oncology"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://hhumc.org.lb/en/department-MD.php"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "governorate": "South",
    "services": [
      "ct",
      "mri",
      "dialysis"
    ]
  },
  {
    "slug": "aubmc-specialty-clinics",
    "name": "AUBMC Specialty Clinics",
    "type": "clinic",
    "city": "Beirut",
    "address": "AUBMC campus: confirm the clinic building when booking",
    "latitude": 33.89812,
    "longitude": 35.48538,
    "locationApproximate": true,
    "phone": "+9611350000",
    "specialties": [
      "pediatrics",
      "internal-medicine"
    ],
    "hoursKnown": true,
    "hours": [
      {
        "day": 1,
        "start": 480,
        "end": 1020
      },
      {
        "day": 2,
        "start": 480,
        "end": 1020
      },
      {
        "day": 3,
        "start": 480,
        "end": 1020
      },
      {
        "day": 4,
        "start": 480,
        "end": 1020
      },
      {
        "day": 5,
        "start": 480,
        "end": 1020
      }
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://aubmc.org.lb/patientcare/dep_div/ambulatory/Pages/pri_cli.aspx"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "governorate": "Beirut",
    "services": []
  },
  {
    "slug": "aubmc-outpatient",
    "name": "AUBMC Outpatient Department",
    "type": "clinic",
    "city": "Beirut",
    "address": "AUBMC campus, Hamra: confirm the entrance when booking",
    "latitude": 33.89812,
    "longitude": 35.48538,
    "locationApproximate": true,
    "phone": "+9611350000",
    "specialties": [
      "family-medicine",
      "internal-medicine",
      "pediatrics",
      "ophthalmology",
      "obstetrics-gynecology",
      "psychiatry",
      "dermatology",
      "surgery",
      "ent"
    ],
    "hoursKnown": true,
    "hours": [
      {
        "day": 1,
        "start": 450,
        "end": 960
      },
      {
        "day": 2,
        "start": 450,
        "end": 960
      },
      {
        "day": 3,
        "start": 450,
        "end": 960
      },
      {
        "day": 4,
        "start": 450,
        "end": 960
      },
      {
        "day": 5,
        "start": 450,
        "end": 960
      }
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.aubmc.org/patientcare/dep_div/ambulatory/Pages/opd.aspx"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "governorate": "Beirut",
    "services": []
  },
  {
    "slug": "saint-george-beirut",
    "name": "Saint George Hospital University Medical Center",
    "type": "hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Ashrafieh-Beirut 11002807 Lebanon",
    "latitude": 33.89516,
    "longitude": 35.52322,
    "specialties": [
      "radiology"
    ],
    "services": [
      "ct",
      "mri"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://betasite.stgeorgehospital.org/services/110/department-of-medical-imaging"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z"
  },
  {
    "slug": "geitaoui",
    "name": "Lebanese Hospital Geitaoui",
    "type": "hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Achrafieh - Jeatawi",
    "latitude": 33.89341,
    "longitude": 35.53072,
    "specialties": [
      "cardiology",
      "pediatrics",
      "obstetrics-gynecology",
      "nephrology",
      "surgery",
      "emergency-medicine",
      "radiology"
    ],
    "services": [
      "burn-unit",
      "nicu",
      "icu",
      "dialysis",
      "maternity"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.hopital-libanais.com/",
      "https://www.hopital-libanais.com/department/critical-care-units",
      "https://syndicateofhospitals.org.lb/Hospitals/Details/130"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "phone": "+9611590000"
  },
  {
    "slug": "chtoura-hospital",
    "name": "Chtoura Hospital",
    "type": "hospital",
    "city": "Chtoura",
    "governorate": "Bekaa",
    "address": "شتورة خلف مخفر الدرك 200 متر",
    "latitude": 33.81904,
    "longitude": 35.8587,
    "specialties": [
      "internal-medicine",
      "surgery",
      "obstetrics-gynecology",
      "orthopedics",
      "neurology",
      "neonatology",
      "pediatrics",
      "emergency-medicine"
    ],
    "services": [
      "nicu",
      "icu",
      "maternity"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.chtourahospital.com/node/1",
      "https://chtourahospital.com/departments"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z"
  },
  {
    "slug": "bekaa-hospital",
    "name": "Bekaa Hospital",
    "type": "hospital",
    "city": "Taalabaya",
    "governorate": "Bekaa",
    "address": "Sanawbar Street, Taalabaya",
    "latitude": 33.810083,
    "longitude": 35.865439,
    "specialties": [
      "emergency-medicine",
      "obstetrics-gynecology",
      "pediatrics",
      "cardiology",
      "radiology",
      "nephrology"
    ],
    "services": [
      "nicu",
      "icu",
      "dialysis",
      "maternity"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://bekaahospital.com/departments/",
      "https://www.bekaahospital.com/index.php"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "emergency24h": true,
    "phone": "+9618543150"
  },
  {
    "slug": "mount-lebanon-hospital",
    "name": "Mount Lebanon Hospital",
    "type": "hospital",
    "city": "Hazmieh",
    "governorate": "Mount Lebanon",
    "address": "Hazmieh- Boulevard Camille Chamoun",
    "latitude": 33.85998,
    "longitude": 35.527885,
    "specialties": [
      "cardiology",
      "oncology",
      "pediatrics",
      "psychiatry",
      "radiology",
      "nephrology",
      "surgery",
      "orthopedics",
      "obstetrics-gynecology"
    ],
    "services": [
      "ct",
      "mri",
      "cath-lab",
      "nicu",
      "icu",
      "dialysis",
      "maternity"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://syndicateofhospitals.org.lb/Hospitals/Details/47"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "phone": "+9615957000"
  },
  {
    "slug": "bellevue-medical-center",
    "name": "Bellevue Medical Center",
    "type": "hospital",
    "city": "Mansourieh",
    "governorate": "Mount Lebanon",
    "address": "Mansourieh",
    "latitude": 33.84838,
    "longitude": 35.559395,
    "specialties": [
      "emergency-medicine",
      "cardiology",
      "radiology"
    ],
    "services": [
      "cath-lab"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.bmc.com.lb/about-bmc/useful-information/",
      "https://www.bmc.com.lb/contact-us/"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "emergency24h": true,
    "phone": "+9611682666"
  },
  {
    "slug": "notre-dame-des-secours",
    "name": "Notre Dame des Secours University Hospital",
    "type": "hospital",
    "city": "Jbeil",
    "governorate": "Keserwan-Jbeil",
    "address": "Street 93 Byblos-Jbeil",
    "latitude": 34.12761,
    "longitude": 35.65919,
    "specialties": [
      "cardiology",
      "surgery",
      "dermatology",
      "obstetrics-gynecology",
      "internal-medicine",
      "nephrology",
      "neurology",
      "ophthalmology",
      "orthopedics",
      "pediatrics",
      "psychiatry",
      "emergency-medicine",
      "radiology"
    ],
    "services": [
      "icu",
      "cath-lab"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://chu-nds.org/en",
      "https://chu-nds.org/fr/ServicesAndunits/unit%C3%A9-de-cath%C3%A9t%C3%A9risme-cardiaque/14/unit%C3%A9-de-cath%C3%A9t%C3%A9risme-cardiaque"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z"
  },
  {
    "slug": "nabih-berri-hospital",
    "name": "Nabih Berri Governmental University Hospital",
    "type": "hospital",
    "city": "Nabatieh",
    "governorate": "Nabatieh",
    "address": "kfarjoz-nabatieh",
    "latitude": 33.38971,
    "longitude": 35.48251,
    "specialties": [
      "cardiology",
      "obstetrics-gynecology",
      "pediatrics",
      "surgery",
      "nephrology",
      "oncology"
    ],
    "services": [
      "cath-lab",
      "burn-unit",
      "maternity",
      "dialysis"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://nbguh.com/contact/",
      "https://moph.gov.lb/en/Media/view/70231/minister-abiad-toured-nabih-berri-governmental-university-hospital-in-nabatiyeh"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "phone": "+9617766888"
  },
  {
    "slug": "akkar-rahal",
    "name": "Akkar Rahal Hospital",
    "type": "hospital",
    "city": "Halba",
    "governorate": "Akkar",
    "address": "Cheikh Mohamad akkar",
    "latitude": 34.576781,
    "longitude": 36.079135,
    "specialties": [
      "radiology",
      "surgery"
    ],
    "services": [
      "ct",
      "mri",
      "cath-lab"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://moph.gov.lb/en/HealthFacilities/view/3/8/71288/akkar-rahal-hospital",
      "https://www.syndicateofhospitals.org.lb/Hospitals/Details/171",
      "https://www.old.jinan.edu.lb/pages/en/Public-Health"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "phone": "+9616690000"
  },
  {
    "slug": "baalbek-governmental",
    "name": "Baalbek Governmental Hospital",
    "type": "hospital",
    "city": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "BAALBACK RAAS EL AIN",
    "latitude": 33.999013,
    "longitude": 36.213593,
    "specialties": [
      "neonatology"
    ],
    "services": [
      "nicu"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.unicef.org/lebanon/press-releases/enhancing-neonatal-health-lebanon-partnership-between-ministry-public-health-unicef"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z"
  },
  {
    "slug": "albert-haykel",
    "name": "Albert Haykel Hospital",
    "type": "hospital",
    "city": "Ras Maska",
    "governorate": "North",
    "address": "Ras Maska-Haykalieh",
    "latitude": 34.41247,
    "longitude": 35.83205,
    "specialties": [
      "cardiology",
      "pediatrics",
      "surgery",
      "emergency-medicine",
      "obstetrics-gynecology",
      "radiology"
    ],
    "services": [
      "ct",
      "mri",
      "cath-lab",
      "nicu",
      "icu",
      "maternity"
    ],
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.haykelhospital.com/home/en/medical/departments",
      "https://www.haykelhospital.com/home/en/about",
      "https://syndicateofhospitals.org.lb/Hospitals/Details/178"
    ],
    "verifiedAt": "2026-10-15T20:50:00Z",
    "phone": "+9616411111"
  }
];
