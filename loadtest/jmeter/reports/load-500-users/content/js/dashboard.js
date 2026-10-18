/*
   Licensed to the Apache Software Foundation (ASF) under one or more
   contributor license agreements.  See the NOTICE file distributed with
   this work for additional information regarding copyright ownership.
   The ASF licenses this file to You under the Apache License, Version 2.0
   (the "License"); you may not use this file except in compliance with
   the License.  You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/
var showControllersOnly = false;
var seriesFilter = "";
var filtersOnlySampleSeries = true;

/*
 * Add header in statistics table to group metrics by category
 * format
 *
 */
function summaryTableHeader(header) {
    var newRow = header.insertRow(-1);
    newRow.className = "tablesorter-no-sort";
    var cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Requests";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 3;
    cell.innerHTML = "Executions";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 7;
    cell.innerHTML = "Response Times (ms)";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 1;
    cell.innerHTML = "Throughput";
    newRow.appendChild(cell);

    cell = document.createElement('th');
    cell.setAttribute("data-sorter", false);
    cell.colSpan = 2;
    cell.innerHTML = "Network (KB/sec)";
    newRow.appendChild(cell);
}

/*
 * Populates the table identified by id parameter with the specified data and
 * format
 *
 */
function createTable(table, info, formatter, defaultSorts, seriesIndex, headerCreator) {
    var tableRef = table[0];

    // Create header and populate it with data.titles array
    var header = tableRef.createTHead();

    // Call callback is available
    if(headerCreator) {
        headerCreator(header);
    }

    var newRow = header.insertRow(-1);
    for (var index = 0; index < info.titles.length; index++) {
        var cell = document.createElement('th');
        cell.innerHTML = info.titles[index];
        newRow.appendChild(cell);
    }

    var tBody;

    // Create overall body if defined
    if(info.overall){
        tBody = document.createElement('tbody');
        tBody.className = "tablesorter-no-sort";
        tableRef.appendChild(tBody);
        var newRow = tBody.insertRow(-1);
        var data = info.overall.data;
        for(var index=0;index < data.length; index++){
            var cell = newRow.insertCell(-1);
            cell.innerHTML = formatter ? formatter(index, data[index]): data[index];
        }
    }

    // Create regular body
    tBody = document.createElement('tbody');
    tableRef.appendChild(tBody);

    var regexp;
    if(seriesFilter) {
        regexp = new RegExp(seriesFilter, 'i');
    }
    // Populate body with data.items array
    for(var index=0; index < info.items.length; index++){
        var item = info.items[index];
        if((!regexp || filtersOnlySampleSeries && !info.supportsControllersDiscrimination || regexp.test(item.data[seriesIndex]))
                &&
                (!showControllersOnly || !info.supportsControllersDiscrimination || item.isController)){
            if(item.data.length > 0) {
                var newRow = tBody.insertRow(-1);
                for(var col=0; col < item.data.length; col++){
                    var cell = newRow.insertCell(-1);
                    cell.innerHTML = formatter ? formatter(col, item.data[col]) : item.data[col];
                }
            }
        }
    }

    // Add support of columns sort
    table.tablesorter({sortList : defaultSorts});
}

$(document).ready(function() {

    // Customize table sorter default options
    $.extend( $.tablesorter.defaults, {
        theme: 'blue',
        cssInfoBlock: "tablesorter-no-sort",
        widthFixed: true,
        widgets: ['zebra']
    });

    var data = {"OkPercent": 99.99240883004889, "KoPercent": 0.007591169951112866};
    var dataset = [
        {
            "label" : "FAIL",
            "data" : data.KoPercent,
            "color" : "#FF6347"
        },
        {
            "label" : "PASS",
            "data" : data.OkPercent,
            "color" : "#9ACD32"
        }];
    $.plot($("#flot-requests-summary"), dataset, {
        series : {
            pie : {
                show : true,
                radius : 1,
                label : {
                    show : true,
                    radius : 3 / 4,
                    formatter : function(label, series) {
                        return '<div style="font-size:8pt;text-align:center;padding:2px;color:white;">'
                            + label
                            + '<br/>'
                            + Math.round10(series.percent, -2)
                            + '%</div>';
                    },
                    background : {
                        opacity : 0.5,
                        color : '#000'
                    }
                }
            }
        },
        legend : {
            show : true
        }
    });

    // Creates APDEX table
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9718443506513224, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9966683535762483, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9943074003795066, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.9987341772151899, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.9977692797960485, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9954068241469817, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.9955414012738854, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [0.9980314960629921, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [0.9960646761912909, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.9984171800136893, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.053130384836300976, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.9996833438885371, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.9984177215189873, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [0.9949367088607595, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9951737451737451, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.9964332036316472, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9993351063829787, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
        switch(index){
            case 0:
                item = item.toFixed(3);
                break;
            case 1:
            case 2:
                item = formatDuration(item);
                break;
        }
        return item;
    }, [[0, 0]], 3);

    // Create statistics table
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 65866, 5, 0.007591169951112866, 452.08802720675743, 3, 26142, 14.0, 47.0, 81.0, 19371.210000000126, 351.24786689419795, 620.4995633799061, 105.86804595009865], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 11856, 0, 0.0, 42.14794197031046, 4, 672, 13.0, 107.0, 210.14999999999964, 458.0, 67.1804170444243, 227.1275427810517, 14.695716228467816], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 1581, 0, 0.0, 69.61543327008226, 7, 23098, 19.0, 106.79999999999995, 200.89999999999986, 506.68000000000166, 8.901024659385206, 8.911426957831326, 4.161458186718838], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 1580, 0, 0.0, 41.903797468354426, 5, 772, 17.0, 93.80000000000018, 178.89999999999964, 426.9500000000003, 8.898250198521088, 8.882575744242889, 4.186228752259762], "isController": false}, {"data": ["S07 Medications GET /api/medications", 1569, 0, 0.0, 45.5653282345443, 7, 598, 19.0, 111.0, 190.0, 417.19999999999936, 8.882271687688231, 11.153054262740314, 4.317525865936573], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 1524, 0, 0.0, 55.46587926509182, 8, 669, 24.0, 139.0, 231.0, 483.5, 8.784165446643687, 7.769732400688208, 4.441357211920874], "isController": false}, {"data": ["B2 Login page /login", 11775, 0, 0.0, 43.07380042462827, 3, 931, 13.0, 108.0, 214.1999999999989, 482.0, 67.02603627090473, 131.82659868125208, 14.989221001989435], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 1524, 0, 0.0, 45.53346456692912, 7, 568, 20.0, 107.5, 186.75, 400.75, 8.784216077882105, 10.223181284691602, 4.510009499662811], "isController": false}, {"data": ["B3 Signup page /signup", 11689, 0, 0.0, 43.26982633244941, 4, 821, 13.0, 110.0, 218.5, 478.0, 66.77520708369038, 157.35212372357896, 14.998337528563267], "isController": false}, {"data": ["B4 API ready /api/health/ready", 11688, 4, 0.034223134839151265, 35.70431211498986, 3, 1359, 12.0, 87.0, 158.0, 351.1100000000006, 66.7691130013539, 33.637920163266706, 15.64901085969232], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 1741, 0, 0.0, 15514.384261918432, 361, 26142, 17066.0, 23681.2, 24427.3, 25143.339999999997, 9.343888367100496, 9.318709747752584, 3.248461190124782], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 1579, 0, 0.0, 43.05699810006327, 7, 541, 20.0, 95.0, 180.0, 376.2000000000005, 8.907165783847512, 11.793735862201238, 4.355691415923463], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 1580, 0, 0.0, 42.32594936708863, 6, 591, 16.0, 84.80000000000018, 190.94999999999982, 448.8500000000008, 8.898200085602937, 7.21020286171465, 4.220963770457413], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 1580, 0, 0.0, 50.179113924050654, 8, 683, 21.0, 106.0, 214.79999999999927, 529.6600000000008, 8.898049750235122, 7.8704831750128115, 4.498956511837785], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 1554, 1, 0.06435006435006435, 51.98133848133846, 10, 996, 23.0, 114.0, 211.5, 477.1000000000017, 8.829695960726603, 10.877599076617782, 5.934127694648204], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 1542, 0, 0.0, 53.798962386511015, 8, 1341, 22.0, 124.70000000000005, 234.69999999999982, 470.69999999999936, 8.82883398700295, 12.018084536300135, 4.317412139288884], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 1504, 0, 0.0, 37.983377659574415, 6, 1255, 14.0, 92.5, 168.0, 357.6500000000003, 8.731342850342228, 5.286555241418147, 4.286714391403923], "isController": false}]}, function(index, item){
        switch(index){
            // Errors pct
            case 3:
                item = item.toFixed(2) + '%';
                break;
            // Mean
            case 4:
            // Mean
            case 7:
            // Median
            case 8:
            // Percentile 1
            case 9:
            // Percentile 2
            case 10:
            // Percentile 3
            case 11:
            // Throughput
            case 12:
            // Kbytes/s
            case 13:
            // Sent Kbytes/s
                item = item.toFixed(2);
                break;
        }
        return item;
    }, [[0, 0]], 0, summaryTableHeader);

    // Create error table
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": [{"data": ["500/Internal Server Error", 5, 100.0, 0.007591169951112866], "isController": false}]}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 65866, 5, "500/Internal Server Error", 5, "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["B4 API ready /api/health/ready", 11688, 4, "500/Internal Server Error", 4, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 1554, 1, "500/Internal Server Error", 1, "", "", "", "", "", "", "", ""], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
