// Published directory information; verifiedAt is a source-review date, not live availability.
// Unknown capabilities remain empty/null. See docs/provider-data-import.md for provenance and exclusions.
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
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "abdullah-al-rassi-governmental",
    "name": "Abdullah Al Rassi Governmental Hospital",
    "city": "Halba",
    "governorate": "Akkar",
    "address": "Akkar Halba Idbil",
    "latitude": 34.53469000031114,
    "longitude": 36.09089000021515,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "tripoli-governmental",
    "name": "Tripoli Governmental Hospital",
    "city": "Tripoli",
    "governorate": "North",
    "address": "North tripoli kobbe",
    "latitude": 34.437170000284794,
    "longitude": 35.86018000040306,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "minieh-governmental",
    "name": "Minieh Governmental Hospital",
    "city": "Minieh",
    "governorate": "North",
    "address": "المنية الاوتوستراد-مفرق المخاضة",
    "latitude": 34.47249566259358,
    "longitude": 35.91558887315341,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "bsharri-governmental",
    "name": "Bsharri Governmental Hospital",
    "city": "Bsharri",
    "governorate": "North",
    "address": "Bcharri - North Lebanon ",
    "latitude": 34.251074441353055,
    "longitude": 36.01680299136137,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "bouar-governmental",
    "name": "Bouar Governmental Hospital",
    "city": "Bouar",
    "governorate": "Keserwan-Jbeil",
    "address": "Mont - Lebanon, Ftouh Kesrouan Bouar – Near Municipality",
    "latitude": 34.04484313433658,
    "longitude": 35.648287348613955,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "rafic-hariri-university",
    "name": "Rafic Hariri University Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Bir  Hasan - Jnah",
    "latitude": 33.86238000011404,
    "longitude": 35.492150000372945,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "baabda-governmental",
    "name": "Baabda Governmental University Hospital",
    "city": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Baabda",
    "latitude": 33.835091811790555,
    "longitude": 35.538722248081356,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "sibline-governmental",
    "name": "Sibline Governmental Hospital",
    "city": "Sibline",
    "governorate": "Mount Lebanon",
    "address": "Sibline",
    "latitude": 33.6169700003301,
    "longitude": 35.43330999981845,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "elias-hraoui-governmental",
    "name": "President Elias Hraoui Governmental Hospital",
    "city": "Zahle",
    "governorate": "Bekaa",
    "address": "Zahle- Maalaka",
    "latitude": 33.84146000011046,
    "longitude": 35.91698999975657,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "rachaya-governmental",
    "name": "Rachaya Governmental Hospital",
    "city": "Rachaya",
    "governorate": "Bekaa",
    "address": "Rachaya Al Akaba",
    "latitude": 33.509640000067975,
    "longitude": 35.82720999960762,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "saida-governmental",
    "name": "Saida Governmental Hospital",
    "city": "Saida",
    "governorate": "South",
    "address": "Saida, Lebanon",
    "latitude": 33.54585000035841,
    "longitude": 35.38149999998014,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "jezzine-governmental",
    "name": "Jezzine Governmental Hospital",
    "city": "Jezzine",
    "governorate": "South",
    "address": "Jezzine",
    "latitude": 33.53833999967561,
    "longitude": 35.58114999964889,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "hasbaya-governmental",
    "name": "Hasbaya Governmental Hospital",
    "city": "Hasbaya",
    "governorate": "Nabatieh",
    "address": "Hasbaya -nabatieh-south",
    "latitude": 33.403149999843095,
    "longitude": 35.68881999988505,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "marjayoun-governmental",
    "name": "Marjayoun Governmental Hospital",
    "city": "Marjayoun",
    "governorate": "Nabatieh",
    "address": "Marjayoun",
    "latitude": 33.36391000029835,
    "longitude": 35.58702999959621,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "tebnine-governmental",
    "name": "Tebnine Governmental Hospital",
    "city": "Tebnine",
    "governorate": "Nabatieh",
    "address": "Nabatieh, Bint Jbeil, Tibnin Main Road",
    "latitude": 33.19579687631792,
    "longitude": 35.41222880475301,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "bint-jbeil-governmental",
    "name": "Bint Jbeil Governmental Hospital",
    "city": "Bint Jbeil",
    "governorate": "Nabatieh",
    "address": "Bint Jbeil",
    "latitude": 33.127575317544306,
    "longitude": 35.43526311780753,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "al-mazloum-hospital",
    "name": "Al Mazloum Hospital",
    "city": "Tripoli",
    "governorate": "North",
    "address": "TRIPOLI DAM W FAREZ ",
    "latitude": 34.431915698257164,
    "longitude": 35.8328470412032,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [
      "burn-unit"
    ],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "al-salam-tripoli",
    "name": "Al Salam Hospital (Hopital de la Paix)",
    "city": "Tripoli",
    "governorate": "North",
    "address": "Tripoli Salam square ",
    "latitude": 34.42065298169831,
    "longitude": 35.82569946359275,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://hopitaldelapaix.com/en"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "beit-chabab-hospital",
    "name": "Beit Chabab Hospital",
    "city": "Beit Chabab",
    "governorate": "Mount Lebanon",
    "address": "  Beit Chabab",
    "latitude": 33.93215000021501,
    "longitude": 35.672899999825994,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "hotel-dieu-de-france",
    "name": "Hotel Dieu de France",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Achrafieh - After Aust",
    "latitude": 33.88124000009534,
    "longitude": 35.51914999991103,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "rosaire-hospital",
    "name": "Rosaire Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Pasteur Street, Gemmayze, Medawar, Beirut, Lebanon",
    "latitude": 33.895818664828326,
    "longitude": 35.5151130887035,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "makassed-general",
    "name": "Makassed General Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Tarik Jadidah ",
    "latitude": 33.87499999973547,
    "longitude": 35.50361099961851,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "trad-hospital",
    "name": "Trad Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Hamra",
    "latitude": 33.896750000304735,
    "longitude": 35.4916199997452,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "fouad-khoury-hospital",
    "name": "Fouad Khoury Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Hamra -Abdel Aziz Street - Moktahi Bldg",
    "latitude": 33.8985773637328,
    "longitude": 35.48424781366931,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "dar-al-ajaza-al-islamia",
    "name": "Dar Al-Ajaza Al-Islamia Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Beirut, Tarik Al Jadida, Abdel Rahman Labban St., East Of Sports City",
    "latitude": 33.86806088170207,
    "longitude": 35.498784159357484,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "al-iman-aley",
    "name": "Al Iman Hospital",
    "city": "Aley",
    "governorate": "Mount Lebanon",
    "address": "Aley",
    "latitude": 33.81069163130556,
    "longitude": 35.61274911832015,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "al-watani-aley",
    "name": "Al Watani Hospital",
    "city": "Aley",
    "governorate": "Mount Lebanon",
    "address": "Aley - Sarayya Street",
    "latitude": 33.80682999972848,
    "longitude": 35.59677000013226,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "ain-w-zain",
    "name": "Ain W Zain Medical Village",
    "city": "Ain W Zain",
    "governorate": "Mount Lebanon",
    "address": " عين وزين public street",
    "latitude": 33.68024000011827,
    "longitude": 35.61124999989252,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "khoury-general-zahle",
    "name": "Khoury General Hospital",
    "city": "Zahle",
    "governorate": "Bekaa",
    "address": "Zahle- Brazilia Street",
    "latitude": 33.85272000023655,
    "longitude": 35.89553000040714,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "tal-chiha-hospital",
    "name": "Tal Chiha Hospital",
    "city": "Zahle",
    "governorate": "Bekaa",
    "address": "Zahle Mar Elias",
    "latitude": 33.8414900002688,
    "longitude": 35.9055100002444,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "rayak-hospital",
    "name": "Rayak Hospital",
    "city": "Rayak",
    "governorate": "Bekaa",
    "address": "Rayak Bekaa",
    "latitude": 33.863679999966955,
    "longitude": 36.011239999691284,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "taanayel-general",
    "name": "Taanayel General Hospital",
    "city": "Taanayel",
    "governorate": "Bekaa",
    "address": "تعنايل الطريق العام",
    "latitude": 33.79409999972943,
    "longitude": 35.8777700000163,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "libano-francais",
    "name": "Libano-Francais Hospital",
    "city": "Zahle",
    "governorate": "Bekaa",
    "address": "Zahle- Haouch El Omara",
    "latitude": 33.8336000002158,
    "longitude": 35.91230999990848,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "west-bekaa-hospital",
    "name": "West Bekaa Hospital",
    "city": "Sahmar",
    "governorate": "Bekaa",
    "address": "سحمر",
    "latitude": 33.51581999974949,
    "longitude": 35.7017299996502,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "hamed-farhat-hospital",
    "name": "Dr Hamed Farhat Hospital",
    "city": "Kamed El Louz",
    "governorate": "Bekaa",
    "address": "Kamed Louz Main road",
    "latitude": 33.629700000130136,
    "longitude": 35.80335199970955,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "hermel-governmental",
    "name": "Hermel Governmental Hospital",
    "city": "Hermel",
    "governorate": "Baalbek-Hermel",
    "address": "Hermel",
    "latitude": 34.381376,
    "longitude": 36.424584,
    "phone": "+9618225312",
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84382/hermel-governmental-hospital",
      "https://www.cedro-undp.org/projects-implementations/hermel-public-hospital"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "beirut-general",
    "name": "Beirut General Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Ramlet Baida, Beirut central street",
    "latitude": 33.873355,
    "longitude": 35.492513,
    "phone": "+9611850213",
    "sources": [
      "https://www.cmsm.org.lb/index.php/providers?page=2",
      "https://www.moph.gov.lb/en/HealthFacilities/view/0/55728/84542/beirut-general-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "najjar-hospital",
    "name": "Najjar Hospital",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Hamra, Wardieh, Abdel-Baki Street",
    "latitude": 33.896817,
    "longitude": 35.486719,
    "phone": "+9611340626",
    "sources": [
      "https://www.cmsm.org.lb/index.php/providers?keywords=Najjar",
      "https://www.moph.gov.lb/fr/HealthFacilities/view/17/85908/84540/najjar-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "al-najdeh-hospital",
    "name": "Al Najdeh Al Chaabiyeh Hospital",
    "city": "Habbouch",
    "governorate": "Nabatieh",
    "address": "Kfarremman main road",
    "latitude": 33.413443,
    "longitude": 35.484123,
    "phone": "+9617530971",
    "sources": [
      "https://www.cmsm.org.lb/index.php/providers?keywords=Najd",
      "https://beirut.diplo.de/resource/blob/2494926/ad07b020fe965573107e810926c50de7/krankenhaeuserliste-data.pdf"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [
      "emergency-medicine"
    ],
    "services": [],
    "emergency24h": true,
    "hoursKnown": false,
    "slug": "clemenceau-medical-center",
    "name": "Clemenceau Medical Center",
    "city": "Beirut",
    "governorate": "Beirut",
    "address": "Clemenceau Street",
    "latitude": 33.89752,
    "longitude": 35.49003,
    "locationApproximate": true,
    "phone": "+9611372888",
    "sources": [
      "https://www.cmc.com.lb/",
      "https://mapcarta.com/W566103031"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "qana-governmental",
    "name": "Qana Governmental Hospital",
    "city": "Qana",
    "governorate": "South",
    "address": "Qana",
    "latitude": 33.21521,
    "longitude": 35.2917,
    "locationApproximate": true,
    "sources": [
      "https://moph.gov.lb/en/Search/tags/1484",
      "https://mapcarta.com/W1019828085"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  },
  {
    "type": "hospital",
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "slug": "bchamoun-speciality",
    "name": "Bchamoun Speciality Hospital",
    "city": "Bchamoun",
    "governorate": "Mount Lebanon",
    "address": "Bchamoun",
    "latitude": 33.78287,
    "longitude": 35.52315,
    "locationApproximate": true,
    "phone": "+9615270970",
    "sources": [
      "https://moph.gov.lb/en/HealthFacilities/index/3/188/8/sort%3AHealthFacility.title/direction%3Aasc/page%3A2",
      "https://mapcarta.com/fr/N4661434309"
    ],
    "verifiedAt": "2026-10-18T12:00:00Z"
  }
];
