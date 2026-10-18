// Published hospital listings; verifiedAt is a source-review date, not live availability.
// Unknown locations/capabilities remain null/empty. See docs/provider-data-import.md.
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
      "https://www.aubmc.org.lb/patientcare/Pages/pat_info.aspx",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84535/american-university-of-beirut-medical-center?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "governorate": "Beirut",
    "services": [],
    "district": "Beirut"
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
      "https://www.laumcrh.com/departments/medical-departments/internal-medicine/emergency-department",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84544/university-medical-center-rizk-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "governorate": "Beirut",
    "services": [],
    "district": "Beirut"
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
      "https://www.hopitalnini.com/en/departments/2-uncategorised",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84639/nine-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "governorate": "North",
    "services": [
      "mri",
      "maternity"
    ],
    "phone": "+9616431400",
    "district": "Tripoli"
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
      "https://hhumc.org.lb/en/department-MD.php",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84651/hammoud-hospital-university-medical-center?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "governorate": "South",
    "services": [
      "ct",
      "mri",
      "dialysis"
    ],
    "district": "Saida"
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
    "verifiedAt": "2026-10-18T12:18:00Z",
    "governorate": "Beirut",
    "services": [],
    "district": "Beirut"
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
    "verifiedAt": "2026-10-18T12:18:00Z",
    "governorate": "Beirut",
    "services": [],
    "district": "Beirut"
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
      "https://betasite.stgeorgehospital.org/services/110/department-of-medical-imaging",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84546/saint-george-hospital-university-medical-center?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://syndicateofhospitals.org.lb/Hospitals/Details/130",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84548/jeatawi-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "phone": "+9611590000",
    "district": "Beirut"
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
      "https://chtourahospital.com/departments",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84558/chtoura-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://www.bekaahospital.com/index.php",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84562/bekaa-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "emergency24h": true,
    "phone": "+9618543150",
    "district": "Zahle"
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
      "https://syndicateofhospitals.org.lb/Hospitals/Details/47",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84582/mount-lebanon-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "phone": "+9615957000",
    "district": "Baabda"
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
      "https://www.bmc.com.lb/contact-us/",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84611/belle-vue-hopital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "emergency24h": true,
    "phone": "+9611682666",
    "district": "Metn"
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
      "https://chu-nds.org/fr/ServicesAndunits/unit%C3%A9-de-cath%C3%A9t%C3%A9risme-cardiaque/14/unit%C3%A9-de-cath%C3%A9t%C3%A9risme-cardiaque",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84593/chu-notre-dame-de-secours-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Jbeil"
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
      "https://moph.gov.lb/en/Media/view/70231/minister-abiad-toured-nabih-berri-governmental-university-hospital-in-nabatiyeh",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84371/nabatieh-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "phone": "+9617766888",
    "district": "Nabatieh"
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
      "https://www.old.jinan.edu.lb/pages/en/Public-Health",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84625/akkar-rahal-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "phone": "+9616690000",
    "district": "Akkar"
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
      "https://www.unicef.org/lebanon/press-releases/enhancing-neonatal-health-lebanon-partnership-between-ministry-public-health-unicef",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84383/baalbeck-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Baalbek"
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
      "https://syndicateofhospitals.org.lb/Hospitals/Details/178",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84628/hopital-albert-haykel-sal?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "phone": "+9616411111",
    "district": "Koura"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84372/dr-abdullah-al-rassi-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Akkar"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84377/tripoli-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Tripoli"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84391/menyeh-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Minieh-Dinnie"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84375/bcharreh-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Bsharri"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84367/ftouh-keserwan-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Keserwan"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84388/beirut-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84390/baabda-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Baabda"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84365/siblin-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Chouf"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84363/president-elias-harawi-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84362/rachaya-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Rachaya"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84379/saida-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Saida"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84378/jezzine-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Jezzine"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84368/hasbaya-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Hasbaya"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84369/marjaayoun-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Marjayoun"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84385/tebnin-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Bint Jbeil"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84384/bent-jbeil-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Bint Jbeil"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84643/new-mazloum-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Tripoli"
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
      "https://hopitaldelapaix.com/en",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84634/al-salam-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Tripoli"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84616/hopital-beit-chabab?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Metn"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84549/hotel-dieu-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84539/rosaire-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84550/makasid-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84551/trad-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84541/fouad-khoury-hospital-associates-sal?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84543/dar-al-ajaza-al-islamia-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84571/al-iman-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Aley"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84566/al-watani-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Aley"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84586/ain-wzen-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Chouf"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84561/khoury-general-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84563/tal-chiha-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84557/rayak-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84560/taanayel-general-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84556/libano-francais-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Zahle"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84552/west-bekaa-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "West Bekaa"
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
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84554/dr-hamed-farhat-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "West Bekaa"
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
      "https://www.cedro-undp.org/projects-implementations/hermel-public-hospital",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84382/hermel-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Hermel"
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
      "https://www.moph.gov.lb/en/HealthFacilities/view/0/55728/84542/beirut-general-hospital?facility_type=8",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84542/beirut-general-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://www.moph.gov.lb/fr/HealthFacilities/view/17/85908/84540/najjar-hospital?facility_type=8",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84540/najjar-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://beirut.diplo.de/resource/blob/2494926/ad07b020fe965573107e810926c50de7/krankenhaeuserliste-data.pdf",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84622/secours-populaire-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Nabatieh"
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
      "https://mapcarta.com/W566103031",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84545/clemenceau-medical-center?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Beirut"
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
      "https://mapcarta.com/W1019828085",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84387/kana-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Tyre"
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
      "https://mapcarta.com/fr/N4661434309",
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84565/bchamoun-speciality-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z",
    "district": "Aley"
  },
  {
    "slug": "specialized-hospital-haidar-and-hajjar",
    "name": "Specialized Hospital Haidar and Hajjar",
    "type": "hospital",
    "city": "Beirut",
    "district": "Beirut",
    "governorate": "Beirut",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84536/specialized-hospital-haidar-and-hajjar?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "child-mother-welfare-society",
    "name": "Child & Mother Welfare Society",
    "type": "hospital",
    "city": "Beirut",
    "district": "Beirut",
    "governorate": "Beirut",
    "address": "Hassana Fathallah Daouk Str. West",
    "latitude": 33.878499707632955,
    "longitude": 35.514977546401845,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84537/child-mother-welfare-society?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/6107"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "bekhaazi-hospital",
    "name": "Bekhaazi Hospital",
    "type": "hospital",
    "city": "Beirut",
    "district": "Beirut",
    "governorate": "Beirut",
    "address": "El Wardieh, Maamari st., Amaret Maktaby bldg., 2nd floor",
    "latitude": 33.89745,
    "longitude": 35.48886,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84538/bekhaazi-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "beirut-eye-specialist-hospital",
    "name": "Beirut Eye Specialist Hospital",
    "type": "hospital",
    "city": "Beirut",
    "district": "Beirut",
    "governorate": "Beirut",
    "address": "Museum Mathaf Square، 116-5311، Hotel Dieu Street, Beirut, Lebanon",
    "latitude": 33.881590621084705,
    "longitude": 35.51255724248133,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84547/beirut-eye-specialist-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/10"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-manara-doctors-hospital",
    "name": "Al Manara Doctors Hospital",
    "type": "hospital",
    "city": "Manara",
    "district": "West Bekaa",
    "governorate": "Bekaa",
    "address": "المنارة البقاع الغربي",
    "latitude": 33.646810000233884,
    "longitude": 35.878079999637684,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84553/al-manara-doctors-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/16"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "bahmad-el-fakih-hospital",
    "name": "Bahmad & el-fakih Hospital",
    "type": "hospital",
    "city": "Dahr El-Ahmar",
    "district": "Rachaya",
    "governorate": "Bekaa",
    "address": "Daher Al-Ahmar Rachaya",
    "latitude": 33.5308899997952,
    "longitude": 35.83180999998808,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84555/bahmad-el-fakih-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/18"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-mayyas-hospital",
    "name": "Al Mayyas Hospital",
    "type": "hospital",
    "city": "Chtoura",
    "district": "Zahle",
    "governorate": "Bekaa",
    "address": "Chtaura square",
    "latitude": 33.815216,
    "longitude": 35.853331,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84559/al-mayyas-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "palestinian-red-crescent-society-nazareth-hospital",
    "name": "Palestinian Red Crescent Society Nazareth Hospital",
    "type": "hospital",
    "city": "",
    "district": "Zahle",
    "governorate": "Bekaa",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84564/palestinian-red-crescent-society-nazareth-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "lebanese-ophthalmic-hospital",
    "name": "Lebanese Ophthalmic Hospital",
    "type": "hospital",
    "city": "Aley",
    "district": "Aley",
    "governorate": "Mount Lebanon",
    "address": "Aley- Piscien St. Edico",
    "latitude": 33.809100000315176,
    "longitude": 35.60246000010876,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84567/lebanese-ophthalmic-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/28"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "medical-2000-hospital",
    "name": "Medical 2000 Hospital",
    "type": "hospital",
    "city": "Choueifat",
    "district": "Aley",
    "governorate": "Mount Lebanon",
    "address": "الشويفات المعروفية",
    "latitude": 33.80341000009966,
    "longitude": 35.51723000011158,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84568/medical-2000-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/29"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "azounieh-hospital",
    "name": "Azounieh Hospital",
    "type": "hospital",
    "city": "",
    "district": "Aley",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84569/azounieh-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "bahman-hospital",
    "name": "Bahman Hospital",
    "type": "hospital",
    "city": "Haret Hreik",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "حارة حريك - شارع دكاش ، قرب مسجد الحسنين - بيروت",
    "latitude": 33.853700000366665,
    "longitude": 35.506440000162414,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84572/bahman-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/31"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-rasoul-al-aazam-hospital",
    "name": "Al-Rasoul Al-Aazam Hospital",
    "type": "hospital",
    "city": "Ghobeiry",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Airport road",
    "latitude": 33.843504,
    "longitude": 35.498457,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84573/al-rasoul-al-aazam-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "sahel-general-hospital",
    "name": "Sahel General Hospital",
    "type": "hospital",
    "city": "Chiyah",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Dergham St.Blg #7, Airport Ave. Haret Hreik. P.O. Box 99/25 Ghobeiry",
    "latitude": 33.8586320002642,
    "longitude": 35.50448199982978,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84574/sahel-general-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/32"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "specialized-medical-rehabilitation-hospital",
    "name": "Specialized Medical Rehabilitation Hospital",
    "type": "hospital",
    "city": "",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84575/specialized-medical-rehabilitation-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "sainte-therese-hospital",
    "name": "Sainte Therese Hospital",
    "type": "hospital",
    "city": "Hadath",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Hadath-Ste Therese Street",
    "latitude": 33.84394851952566,
    "longitude": 35.527253417323145,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84576/sainte-therese-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/34"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "st-georges-hadath-hospital",
    "name": "St Georges Hadath Hospital",
    "type": "hospital",
    "city": "Hadath",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Old Saida Street - Hadath",
    "latitude": 33.83745635808423,
    "longitude": 35.53209220427913,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84577/st-georges-hadath-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/35"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "borj-hospital",
    "name": "Borj Hospital",
    "type": "hospital",
    "city": "Chiyah",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Borj Barajneh Osman Street",
    "latitude": 33.84321499986565,
    "longitude": 35.49190699980038,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84578/borj-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/36"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-saint-charles",
    "name": "Hopital Saint Charles",
    "type": "hospital",
    "city": "Baabda",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Fayadie",
    "latitude": 33.84468200006043,
    "longitude": 35.55031999965929,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84579/hopital-saint-charles?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/37"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "sacre-coeur-hospital",
    "name": "Sacre Coeur Hospital",
    "type": "hospital",
    "city": "Baabda",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Brazilia - Baabda, Bp 116 - Hazmieh",
    "latitude": 33.84979999967761,
    "longitude": 35.53910999958556,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84580/sacre-coeur-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/40"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-zahraa-hospital-university-medical-center",
    "name": "Al-Zahraa Hospital University Medical Center",
    "type": "hospital",
    "city": "Chiyah",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Jnah-Facing Golden Tulip Hotel",
    "latitude": 33.86485999964622,
    "longitude": 35.48660000013849,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84581/al-zahraa-hospital-university-medical-center?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/4"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-hayat-hospital",
    "name": "Al Hayat Hospital",
    "type": "hospital",
    "city": "Chiyah",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Beirut",
    "latitude": 33.86736484312327,
    "longitude": 35.52408632773722,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84583/al-hayat-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/146"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "clinique-dr-georges-moarbes",
    "name": "Clinique Dr. Georges Moarbes",
    "type": "hospital",
    "city": "Chiyah",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "Furn Al Chebek",
    "latitude": 33.87297499981944,
    "longitude": 35.51910800007823,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84584/clinique-dr-georges-moarbes?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/39"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-francais-st-lourdes",
    "name": "Hopital Francais - St Lourdes",
    "type": "hospital",
    "city": "",
    "district": "Baabda",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84585/hopital-francais-st-lourdes?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "alerfan-hospital",
    "name": "Alerfan Hospital",
    "type": "hospital",
    "city": "Semqaniyeh",
    "district": "Chouf",
    "governorate": "Mount Lebanon",
    "address": "السمقانية",
    "latitude": 33.67526999992841,
    "longitude": 35.5919499996438,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84587/alerfan-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/43"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "osman-hospital",
    "name": "Osman Hospital",
    "type": "hospital",
    "city": "",
    "district": "Chouf",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84589/osman-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "baakleenhospital",
    "name": "BaakleenHospital",
    "type": "hospital",
    "city": "Baakline",
    "district": "Chouf",
    "governorate": "Mount Lebanon",
    "address": "MONT-LEBANON, CHOUF, BAAKLINE -CHOUF",
    "latitude": 33.678551806014895,
    "longitude": 35.574442625273754,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84590/baakleenhospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/152"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-maritime-jbeil",
    "name": "Hopital Maritime Jbeil",
    "type": "hospital",
    "city": "Jbeil",
    "district": "Jbeil",
    "governorate": "Keserwan-Jbeil",
    "address": "Jbeil Voie 13",
    "latitude": 34.11565000007362,
    "longitude": 35.65222999959872,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84591/hopital-maritime-jbeil?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/46"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-saint-michel-amchit",
    "name": "Hopital Saint- Michel Amchit",
    "type": "hospital",
    "city": "Amchit",
    "district": "Jbeil",
    "governorate": "Keserwan-Jbeil",
    "address": "Amchit -Saint Michel",
    "latitude": 34.14460114569242,
    "longitude": 35.64579202368907,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84592/hopital-saint-michel-amchit?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/47"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "saint-louis-hospital-s-a-l",
    "name": "Saint Louis Hospital S.A.L",
    "type": "hospital",
    "city": "",
    "district": "Keserwan",
    "governorate": "Keserwan-Jbeil",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84594/saint-louis-hospital-sal?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "st-georges-hospital",
    "name": "St Georges Hospital",
    "type": "hospital",
    "city": "Ajaltoun",
    "district": "Keserwan",
    "governorate": "Keserwan-Jbeil",
    "address": "Ajaltoun,George Matta St",
    "latitude": 33.9601200001165,
    "longitude": 35.68734000030163,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84595/st-georges-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/50"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hospital-mgr-cortbawi",
    "name": "Hospital MGR Cortbawi",
    "type": "hospital",
    "city": "Adma",
    "district": "Keserwan",
    "governorate": "Keserwan-Jbeil",
    "address": "Adma,Zone Orange ,Rue 3",
    "latitude": 34.01973000031292,
    "longitude": 35.648630000199276,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84596/hospital-mgr-cortbawi?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/51"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "kesserwan-medical-center",
    "name": "Kesserwan Medical Center",
    "type": "hospital",
    "city": "Ghazir",
    "district": "Keserwan",
    "governorate": "Keserwan-Jbeil",
    "address": "Jounie highway, Kfarehbab bifurcation",
    "latitude": 34.010389,
    "longitude": 35.647717,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84597/kesserwan-medical-center?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=3"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "notre-dame-de-liban-hospital",
    "name": "Notre Dame de Liban Hospital",
    "type": "hospital",
    "city": "Jounieh",
    "district": "Keserwan",
    "governorate": "Keserwan-Jbeil",
    "address": "Jounieh,Rue Gl.Fouad Chehab",
    "latitude": 33.98144000018604,
    "longitude": 35.62775999995545,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84599/notre-dame-de-liban-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/53"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "psychiatric-hospital-of-the-cross",
    "name": "Psychiatric Hospital of the Cross",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84600/psychiatric-hospital-of-the-cross?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "arz-hospital",
    "name": "Arz Hospital",
    "type": "hospital",
    "city": "Zalka",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Zalka",
    "latitude": 33.89900999970548,
    "longitude": 35.57282000017269,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84601/arz-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/55"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "eye-ear-hospital-international",
    "name": "Eye & Ear Hospital International",
    "type": "hospital",
    "city": "Dbayeh",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Naccache- Dbayeh",
    "latitude": 33.9271600000039,
    "longitude": 35.59191000035914,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84602/eye-ear-hospital-international?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/56"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "middle-east-institutd-of-health",
    "name": "Middle East Institutd Of Health",
    "type": "hospital",
    "city": "Bsalim",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Mezher st.",
    "latitude": 33.905756,
    "longitude": 35.593901,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84603/middle-east-institutd-of-health?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=3"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-abou-jaouke",
    "name": "Hopital Abou Jaouke",
    "type": "hospital",
    "city": "Jal El Dib",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Jal El Dib",
    "latitude": 33.90717999981517,
    "longitude": 35.58172999960702,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84604/hopital-abou-jaouke?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/58"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "sach-medical-co-bitar-hospital",
    "name": "SACH Medical Co.Bitar Hospital",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84605/sach-medical-cobitar-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "lebanise-canadian-hospital",
    "name": "Lebanise--Canadian Hospital",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84606/lebanise-canadian-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "serhal-hospital",
    "name": "Serhal Hospital",
    "type": "hospital",
    "city": "Qornet Chehwan",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Rabieh",
    "latitude": 33.914948378195405,
    "longitude": 35.60861775375204,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84607/serhal-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/61"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "centre-hopital-de-behannss",
    "name": "Centre Hopital de Behannss",
    "type": "hospital",
    "city": "Dahr El Souane",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Dahr El Savvan- Mathen",
    "latitude": 33.90557000010635,
    "longitude": 35.65653000040348,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84608/centre-hopital-de-behannss?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/62"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "saint-joseph-hospital",
    "name": "Saint Joseph Hospital",
    "type": "hospital",
    "city": "Bauchrieh",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Dora- Lebanon",
    "latitude": 33.89267999997353,
    "longitude": 35.55511000001052,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84609/saint-joseph-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/63"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "haroun-hospital",
    "name": "Haroun Hospital",
    "type": "hospital",
    "city": "Amaret Chalhoub",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Amaret Chalhoub- Rue Hopital Haroun",
    "latitude": 33.900440000044185,
    "longitude": 35.571630000119164,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84610/haroun-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/64"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-dar-al-raheme",
    "name": "Hopital DAR AL Raheme?",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84612/hopital-dar-al-raheme-?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "clinique-du-levant-sm",
    "name": "Clinique du Levant SM",
    "type": "hospital",
    "city": "Deir mar Roukoz",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Hôpital du Levant, Rue 72, Sinn El Fil, Maten, Mont Liban, LBN",
    "latitude": 33.87270206266782,
    "longitude": 35.555994304271145,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84613/clinique-du-levant-sm?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/150"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-notre-dame-pour-les-malade-cronique",
    "name": "Hopital Notre dame pour les Malade Cronique",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84614/hopital-notre-dame-pour-les-malade-cronique?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-hayek",
    "name": "Hopital Hayek",
    "type": "hospital",
    "city": "Sin El Fil",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Sin El Fil",
    "latitude": 33.870799999710435,
    "longitude": 35.53787000020166,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84615/hopital-hayek?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/69"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "clinique-de-chirugie-estetque-dr-nader-saab",
    "name": "Clinique DE Chirugie Estetque Dr Nader Saab",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84617/clinique-de-chirugie-estetque-dr-nader-saab?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-dr-toni-nassar-sal",
    "name": "Hopital Dr Toni Nassar Sal",
    "type": "hospital",
    "city": "",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84618/hopital-dr-toni-nassar-sal?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "alhamid-medical-center-ghandour-hospital",
    "name": "Alhamid Medical Center-Ghandour Hospital",
    "type": "hospital",
    "city": "",
    "district": "Nabatieh",
    "governorate": "Nabatieh",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84619/alhamid-medical-center-ghandour-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "kalout-hospital",
    "name": "Kalout Hospital",
    "type": "hospital",
    "city": "",
    "district": "Nabatieh",
    "governorate": "Nabatieh",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84620/kalout-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "alcheick-harb-hospital",
    "name": "AlCheick Harb Hospital",
    "type": "hospital",
    "city": "Nabatie Fawka",
    "district": "Nabatieh",
    "governorate": "Nabatieh",
    "address": "El Toul main road",
    "latitude": 33.386249,
    "longitude": 35.440925,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84621/alcheick-harb-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=4"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-hikme-hospital",
    "name": "Al Hikme Hospital",
    "type": "hospital",
    "city": "",
    "district": "Nabatieh",
    "governorate": "Nabatieh",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84623/al-hikme-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "ghossein-hospital",
    "name": "Ghossein Hospital",
    "type": "hospital",
    "city": "",
    "district": "Nabatieh",
    "governorate": "Nabatieh",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84624/ghossein-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-notre-dame-de-la-paix",
    "name": "Hopital Notre Dame de la Paix",
    "type": "hospital",
    "city": "Kobayat",
    "district": "Akkar",
    "governorate": "Akkar",
    "address": "القبيات شويتا",
    "latitude": 34.57045000032269,
    "longitude": 36.25499999990898,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84626/hopital-notre-dame-de-la-paix?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/82"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "el-youssef-hospital-center",
    "name": "El Youssef Hospital Center",
    "type": "hospital",
    "city": "Halba",
    "district": "Akkar",
    "governorate": "Akkar",
    "address": "Halba main road",
    "latitude": 34.542950000159806,
    "longitude": 36.07453999998581,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84627/el-youssef-hospital-center?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/79"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hopital-al-borgi",
    "name": "Hopital Al Borgi",
    "type": "hospital",
    "city": "",
    "district": "Koura",
    "governorate": "North",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84630/hopital-al-borgi?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-kheir-hospital-miniyeh",
    "name": "Al Kheir Hospital- Miniyeh",
    "type": "hospital",
    "city": "Minieh",
    "district": "Minieh-Dinnie",
    "governorate": "North",
    "address": "main road Minieh",
    "latitude": 34.48239999977842,
    "longitude": 35.94042000003247,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84631/al-kheir-hospital-miniyeh?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/85"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "dar-al-shifa-hospital",
    "name": "Dar Al shifa hospital",
    "type": "hospital",
    "city": "Tripoli",
    "district": "Tripoli",
    "governorate": "North",
    "address": "Tripoli zaytoun Abu Samra",
    "latitude": 34.41568000036374,
    "longitude": 35.8429699998331,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84633/dar-al-shifa-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/87"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "social-services-association-dar-al-ajaza-hospice",
    "name": "Social Services Association - Dar Al Ajaza Hospice",
    "type": "hospital",
    "city": "",
    "district": "Tripoli",
    "governorate": "North",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84635/social-services-association-dar-al-ajaza-hospice?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "el-bissar-hospital",
    "name": "El Bissar Hospital",
    "type": "hospital",
    "city": "",
    "district": "Tripoli",
    "governorate": "North",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84636/el-bissar-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "shahin-hospital",
    "name": "Shahin Hospital",
    "type": "hospital",
    "city": "",
    "district": "Tripoli",
    "governorate": "North",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84637/shahin-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-mounla-hospital",
    "name": "Al Mounla Hospital",
    "type": "hospital",
    "city": "Tripoli",
    "district": "Tripoli",
    "governorate": "North",
    "address": "Tripoli Monla road",
    "latitude": 34.43790973278787,
    "longitude": 35.82886525151983,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84638/al-mounla-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/92"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "dar-al-zahraa-hospital",
    "name": "Dar Al Zahraa Hospital",
    "type": "hospital",
    "city": "Tripoli",
    "district": "Tripoli",
    "governorate": "North",
    "address": "Tripoli Abou  Samra Zaytoun",
    "latitude": 34.41953999974824,
    "longitude": 35.84023999992171,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84640/dar-al-zahraa-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/94"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "islamic-hospital",
    "name": "Islamic Hospital",
    "type": "hospital",
    "city": "Tripoli",
    "district": "Tripoli",
    "governorate": "North",
    "address": "Azmi street Centre Ville Tripoli",
    "latitude": 34.44219999986197,
    "longitude": 35.83218999992967,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84641/islamic-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/95"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-hanan-hospital",
    "name": "Al-Hanan Hospital",
    "type": "hospital",
    "city": "Tripoli",
    "district": "Tripoli",
    "governorate": "North",
    "address": "TRIPOLI-alsakafa- TAWJIH STREET",
    "latitude": 34.443879999967976,
    "longitude": 35.83415999995787,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84642/al-hanan-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/96"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-rahma-hospital",
    "name": "Al Rahma Hospital",
    "type": "hospital",
    "city": "",
    "district": "Tripoli",
    "governorate": "North",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84644/al-rahma-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-rahban-hospital",
    "name": "Al Rahban Hospital",
    "type": "hospital",
    "city": "",
    "district": "Zgharta",
    "governorate": "North",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84645/al-rahban-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hospital-saydet-zgharta",
    "name": "Hospital Saydet Zgharta",
    "type": "hospital",
    "city": "Zgharta",
    "district": "Zgharta",
    "governorate": "North",
    "address": "Zgharta AL ROUAYSS",
    "latitude": 34.399540000002524,
    "longitude": 35.88612999962973,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84646/hospital-saydet-zgharta?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/101"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "centre-hospitalier-du-nord",
    "name": "Centre Hospitalier du Nord",
    "type": "hospital",
    "city": "Deir Jdeide",
    "district": "Zgharta",
    "governorate": "North",
    "address": "Jdeidet zgharta Rue Principale",
    "latitude": 34.36945000006255,
    "longitude": 35.89832999974043,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84647/centre-hospitalier-du-nord?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/102"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "alaa-el-dine-hospital",
    "name": "Alaa-El-Dine Hospital",
    "type": "hospital",
    "city": "Sarafand",
    "district": "Saida",
    "governorate": "South",
    "address": "Sarafand Main Road",
    "latitude": 33.45966999992628,
    "longitude": 35.28926000025657,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84650/alaa-el-dine-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/104"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "dalaa-hospital",
    "name": "Dalaa Hospital",
    "type": "hospital",
    "city": "Saida",
    "district": "Saida",
    "governorate": "South",
    "address": "Saida.Derkman",
    "latitude": 33.55740000022004,
    "longitude": 35.37748999960359,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84652/dalaa-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/106"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "health-medical-center-osseiran-hospital",
    "name": "Health Medical Center- Osseiran Hospital",
    "type": "hospital",
    "city": "Saida",
    "district": "Saida",
    "governorate": "South",
    "address": "Saida-Blv Maarouf Saad",
    "latitude": 33.553289999778286,
    "longitude": 35.36999000033077,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84653/health-medical-center-osseiran-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/107"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "alraai-hospital",
    "name": "Alraai Hospital",
    "type": "hospital",
    "city": "Ghaziyeh",
    "district": "Saida",
    "governorate": "South",
    "address": "Saida-Saynik Street",
    "latitude": 33.53147999996451,
    "longitude": 35.36210000017229,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84654/alraai-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/108"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "aljanoub-hospital",
    "name": "Aljanoub Hospital",
    "type": "hospital",
    "city": "",
    "district": "Saida",
    "governorate": "South",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84655/aljanoub-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "kassab-hospital",
    "name": "Kassab Hospital",
    "type": "hospital",
    "city": "Hlaliyeh",
    "district": "Saida",
    "governorate": "South",
    "address": "Saida El Hlalye",
    "latitude": 33.56882257084871,
    "longitude": 35.39162956212571,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84656/kassab-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/110"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-hamshari-hospital",
    "name": "Al Hamshari Hospital",
    "type": "hospital",
    "city": "",
    "district": "Saida",
    "governorate": "South",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84657/al-hamshari-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "labib-medical-center",
    "name": "Labib Medical center",
    "type": "hospital",
    "city": "Saida",
    "district": "Saida",
    "governorate": "South",
    "address": "saida, lebanon",
    "latitude": 33.55595371399306,
    "longitude": 35.37374617992718,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84658/labib-medical-center?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/148"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "abed-el-rahman-al-nakib-hospital",
    "name": "Abed El Rahman Al Nakib Hospital",
    "type": "hospital",
    "city": "",
    "district": "Saida",
    "governorate": "South",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84659/abed-el-rahman-al-nakib-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "fakih-hospital",
    "name": "Fakih Hospital",
    "type": "hospital",
    "city": "Saksakiyeh",
    "district": "Saida",
    "governorate": "South",
    "address": "South Lebanon , Saida, Saksakyieh Khaizaran Main Street",
    "latitude": 33.43447435501468,
    "longitude": 35.27421201820005,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84660/fakih-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/151"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "salman-zainndine",
    "name": "Salman Zainndine",
    "type": "hospital",
    "city": "",
    "district": "Tyre",
    "governorate": "South",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84661/salman-zainndine?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "hiram-hospital",
    "name": "Hiram Hospital",
    "type": "hospital",
    "city": "Abbassieh",
    "district": "Tyre",
    "governorate": "South",
    "address": "Sour-Jal El Baher",
    "latitude": 33.28197999984233,
    "longitude": 35.222830000017595,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84662/hiram-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/112"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "najem-hospital",
    "name": "Najem Hospital",
    "type": "hospital",
    "city": "",
    "district": "Tyre",
    "governorate": "South",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84663/najem-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "rida-mroue-hospital",
    "name": "Rida Mroue Hospital",
    "type": "hospital",
    "city": "Abbassieh",
    "district": "Tyre",
    "governorate": "South",
    "address": "Sour-Jal El Baher Al Aabasieh",
    "latitude": 33.278219999791524,
    "longitude": 35.21863999971597,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84664/rida-mroue-hospital?facility_type=8",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/113"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "jabal-amel-hospital",
    "name": "Jabal Amel Hospital",
    "type": "hospital",
    "city": "Abbassieh",
    "district": "Tyre",
    "governorate": "South",
    "address": "Tyr north entrance, Jal El Baher area",
    "latitude": 33.278615,
    "longitude": 35.217541,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84665/jabal-amel-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=3"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "iben-sinna-hospital",
    "name": "Iben Sinna Hospital",
    "type": "hospital",
    "city": "",
    "district": "Hermel",
    "governorate": "Baalbek-Hermel",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84666/iben-sinna-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-batoul-hospital",
    "name": "Al Batoul Hospital",
    "type": "hospital",
    "city": "",
    "district": "Hermel",
    "governorate": "Baalbek-Hermel",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84667/al-batoul-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-assi-hospital",
    "name": "Al Assi Hospital",
    "type": "hospital",
    "city": "Hermel",
    "district": "Hermel",
    "governorate": "Baalbek-Hermel",
    "address": "Al Maalli area",
    "latitude": 34.3986398,
    "longitude": 36.4087779,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84668/al-assi-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "dar-al-amal-hospital",
    "name": "Dar Al Amal Hospital",
    "type": "hospital",
    "city": "Baalbek",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "Douris st.",
    "latitude": 33.984195,
    "longitude": 36.16009,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84669/dar-al-amal-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=2"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "dar-al-hikma-hospital",
    "name": "Dar Al Hikma Hospital",
    "type": "hospital",
    "city": "Baalbek",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "Tal El Abyad, Homs national st.",
    "latitude": 34.038107,
    "longitude": 36.190829,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84670/dar-al-hikma-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=2"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-tatari-hospital",
    "name": "Al Tatari Hospital",
    "type": "hospital",
    "city": "Baalbek",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "Bechara El Khoury street",
    "latitude": 34.010584,
    "longitude": 36.205286,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84671/al-tatari-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=4"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "al-rayan-hospital",
    "name": "Al Rayan Hospital",
    "type": "hospital",
    "city": "Baalbek",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "Al Charawneh st.",
    "latitude": 34.026633,
    "longitude": 36.195689,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84672/al-rayan-hospital?facility_type=8",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "mortada-hospital",
    "name": "Mortada Hospital",
    "type": "hospital",
    "city": "",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84673/mortada-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "universal-hospital",
    "name": "Universal Hospital",
    "type": "hospital",
    "city": "",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84674/universal-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "temnine-general-hospital",
    "name": "Temnine General Hospital",
    "type": "hospital",
    "city": "",
    "district": "Baalbek",
    "governorate": "Baalbek-Hermel",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84675/temnine-general-hospital?facility_type=8"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "governmental-hospital-of-beirut-quarantine",
    "name": "Governmental Hospital of Beirut Quarantine",
    "type": "hospital",
    "city": "Beirut",
    "district": "Beirut",
    "governorate": "Beirut",
    "address": "بيروت - الكرنتينا - المدور",
    "latitude": 33.90203999978967,
    "longitude": 35.529699999660686,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84361/governmental-hospital-of-beirut-quarantine?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/115"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "shahar-gharbi-govermental-hospital",
    "name": "Shahar gharbi govermental hospital",
    "type": "hospital",
    "city": "Remhala",
    "district": "Aley",
    "governorate": "Mount Lebanon",
    "address": "Remhala Kabreshmol, aley",
    "latitude": 33.75448000002362,
    "longitude": 35.54479000041464,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84364/shahar-gharbi-govermental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/118"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "kartaba-governmental-hospital",
    "name": "Kartaba Governmental Hospital",
    "type": "hospital",
    "city": "Kartaba",
    "district": "Jbeil",
    "governorate": "Keserwan-Jbeil",
    "address": "قرطبا الساحة العامة",
    "latitude": 34.096380000127844,
    "longitude": 35.85150000022414,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84366/kartaba-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/120"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "mays-el-jabal-governmental-hospital",
    "name": "Mays el jabal governmental hospital",
    "type": "hospital",
    "city": "Mays El Jabal",
    "district": "Marjayoun",
    "governorate": "Nabatieh",
    "address": "Meiss El Jabal - Main Road Houla-Meiss El Jabal",
    "latitude": 33.18675923887886,
    "longitude": 35.52135892575367,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84370/mays-el-jabal-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/284"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "tannourine-governmental-hospital",
    "name": "Tannourine governmental hospital",
    "type": "hospital",
    "city": "Tannourin Tahta",
    "district": "Batroun",
    "governorate": "North",
    "address": "Main road",
    "latitude": 34.212547,
    "longitude": 35.861156,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84373/tannourine-governmental-hospital?facility_type=1",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=4"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "batroun-governmental-hospital",
    "name": "Batroun Governmental Hospital",
    "type": "hospital",
    "city": "Batroun",
    "district": "Batroun",
    "governorate": "North",
    "address": "Main road",
    "latitude": 34.251027,
    "longitude": 35.665762,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84374/batroun-governmental-hospital?facility_type=1",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "sir-denniye-governmental-hospital",
    "name": "Sir Denniye governmental hospital",
    "type": "hospital",
    "city": "Assoun",
    "district": "Minieh-Dinnie",
    "governorate": "North",
    "address": "Dennieh Assoun",
    "latitude": 34.38226485115674,
    "longitude": 36.01058876333113,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84376/sir-denniye-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/129"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "ehden-governmental-hospital",
    "name": "Ehden governmental hospital",
    "type": "hospital",
    "city": "Ehden",
    "district": "Zgharta",
    "governorate": "North",
    "address": "Ehden Midan square",
    "latitude": 34.290089999718454,
    "longitude": 35.968380000368626,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84380/ehden-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/131"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "orange-nassau-governmental-hospital",
    "name": "Orange Nassau governmental hospital",
    "type": "hospital",
    "city": "Tripoli",
    "district": "Tripoli",
    "governorate": "North",
    "address": "Tripoli",
    "latitude": 34.45088262337987,
    "longitude": 35.853419714359354,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84381/orange-nassau-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/99"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "sour-governmental-hospital",
    "name": "sour governmental hospital",
    "type": "hospital",
    "city": "Tyre",
    "district": "Tyre",
    "governorate": "South",
    "address": "Tyre",
    "latitude": 33.27207606826316,
    "longitude": 35.211423824953826,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84386/sour-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/134"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "daher-elbachek-governmental-hospital",
    "name": "Daher elbachek governmental hospital",
    "type": "hospital",
    "city": "Roumieh",
    "district": "Metn",
    "governorate": "Mount Lebanon",
    "address": "Roumieh El Meten - Prison Road",
    "latitude": 33.88315672097074,
    "longitude": 35.59881236304985,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84389/daher-elbachek-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/121"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "machghara-governmental-hospital",
    "name": "Machghara Governmental Hospital",
    "type": "hospital",
    "city": "Machghara",
    "district": "West Bekaa",
    "governorate": "Bekaa",
    "address": "West Bekaa - Machghara - Main Road",
    "latitude": 33.521704248977535,
    "longitude": 35.674936117655726,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84392/machghara-governmental-hospital?facility_type=1",
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/149"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "kherbet-kanafar-governmental-hospital",
    "name": "Kherbet Kanafar Governmental Hospital",
    "type": "hospital",
    "city": "",
    "district": "West Bekaa",
    "governorate": "Bekaa",
    "address": "",
    "latitude": null,
    "longitude": null,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://www.moph.gov.lb/en/HealthFacilities/view/3/188/84393/kherbet-kanafar-governmental-hospital?facility_type=1"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "khalaf-al-habtoor-hospital",
    "name": "Khalaf Al  Habtoor Hospital",
    "type": "hospital",
    "city": "Hrar",
    "district": "Akkar",
    "governorate": "Akkar",
    "address": "Akkar Hrar Ain al Bayad",
    "latitude": 34.46023016036601,
    "longitude": 36.12462660171449,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/147"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "lebanese-italian-hospital",
    "name": "Lebanese Italian Hospital",
    "type": "hospital",
    "city": "Borj El Chemali",
    "district": "Tyre",
    "governorate": "South",
    "address": "South",
    "latitude": 33.254080282956586,
    "longitude": 35.22460810822301,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/155"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "lebanese-american-university-medical-center-saint-john-s-hospital",
    "name": "Lebanese American University Medical Center - Saint John' s Hospital",
    "type": "hospital",
    "city": "Jounieh",
    "district": "Keserwan",
    "governorate": "Keserwan-Jbeil",
    "address": "Jounieh –  sea side road",
    "latitude": 33.981962962934624,
    "longitude": 35.63053724945414,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/160"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "family-medical-center",
    "name": "Family Medical Center",
    "type": "hospital",
    "city": "Mejdlaya",
    "district": "Zgharta",
    "governorate": "North",
    "address": "El Karmalie st.",
    "latitude": 34.417182,
    "longitude": 35.88278,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/7802",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=2"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "martyr-salah-ghandour-hospital",
    "name": "Martyr Salah Ghandour Hospital",
    "type": "hospital",
    "city": "Bint Jbeil",
    "district": "Bint Jbeil",
    "governorate": "Nabatieh",
    "address": "Saff Al Hawa main road",
    "latitude": 33.131253,
    "longitude": 35.4297592,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/7911",
      "https://www.cmsm.org.lb/index.php/providers?category=Hospital&page=4"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  },
  {
    "slug": "mazboud-central-hospital",
    "name": "Mazboud Central Hospital",
    "type": "hospital",
    "city": "Mazboud",
    "district": "Chouf",
    "governorate": "Mount Lebanon",
    "address": "مزبود",
    "latitude": 33.61407000012205,
    "longitude": 35.472159999662885,
    "specialties": [],
    "services": [],
    "emergency24h": null,
    "hoursKnown": false,
    "sources": [
      "https://maps.moph.gov.lb/server/rest/services/Health_Facility_Locator/MapServer/0/44"
    ],
    "verifiedAt": "2026-10-18T12:18:00Z"
  }
];
