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

    var data = {"OkPercent": 100.0, "KoPercent": 0.0};
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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9958729244649198, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9970686767169179, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9979123173277662, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [0.9979123173277662, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.997907949790795, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9967672413793104, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.9970513900589723, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [1.0, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [0.9978759558198811, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.9987255734919286, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.9576446280991735, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.9989561586638831, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [0.9979123173277662, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [1.0, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9957446808510638, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.9978586723768736, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9945887445887446, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 10419, 0, 0.0, 50.198675496688615, 2, 1978, 12.0, 120.0, 340.0, 468.0, 58.688011175450065, 88.12154177662336, 21.801840874110017], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 1194, 0, 0.0, 30.698492462311613, 2, 1582, 9.0, 68.0, 119.0, 285.5499999999986, 6.751140739232948, 22.82465746018014, 1.4768120367072073], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 479, 0, 0.0, 35.3319415448852, 5, 1387, 13.0, 83.0, 144.0, 317.79999999999956, 2.7990089521538932, 2.8033858275337167, 1.3120354463221373], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 479, 0, 0.0, 29.693110647181644, 5, 1674, 12.0, 61.0, 122.0, 197.79999999999995, 2.798992596401629, 2.7951692725833124, 1.3202279531855339], "isController": false}, {"data": ["S07 Medications GET /api/medications", 478, 0, 0.0, 37.037656903765686, 5, 845, 14.0, 88.20000000000005, 141.0999999999999, 312.45999999999947, 2.793622592107724, 3.6274596243366606, 1.3613453842399943], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 464, 0, 0.0, 39.43534482758619, 6, 991, 15.0, 90.5, 143.0, 327.8500000000007, 2.754771870454478, 2.440017662599816, 1.396217383560424], "isController": false}, {"data": ["B2 Login page /login", 1187, 0, 0.0, 33.77085088458302, 2, 1632, 9.0, 79.0, 135.0, 360.2399999999998, 6.788404238892352, 13.351412243290232, 1.5181099323304186], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 464, 0, 0.0, 29.299568965517267, 5, 399, 13.0, 63.0, 131.5, 220.80000000000018, 2.754526565746512, 3.2091310477886617, 1.4176127931136837], "isController": false}, {"data": ["B3 Signup page /signup", 1177, 0, 0.0, 32.32710280373837, 2, 1218, 9.0, 74.20000000000005, 126.0, 320.6600000000001, 6.7701263143363315, 15.95343241845075, 1.520633840134137], "isController": false}, {"data": ["B4 API ready /api/health/ready", 1177, 0, 0.0, 27.304163126593025, 2, 1647, 8.0, 79.0, 127.0, 219.98000000000025, 6.771333728375742, 3.412117386564339, 1.5870313425880647], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 484, 0, 0.0, 411.9834710743799, 257, 1978, 394.0, 490.0, 524.75, 749.1499999999995, 2.791282432798722, 2.78474374376431, 0.9704067832776807], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 479, 0, 0.0, 26.766179540709793, 7, 1366, 14.0, 50.0, 76.0, 164.59999999999985, 2.7984039165970476, 3.590338714954226, 1.3718737950505056], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 479, 0, 0.0, 31.43632567849688, 5, 1478, 12.0, 62.0, 117.0, 199.19999999999987, 2.798551063332554, 2.2710897789349147, 1.3309515310966347], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 479, 0, 0.0, 26.083507306889366, 6, 241, 14.0, 54.0, 104.0, 202.59999999999997, 2.7985183627206975, 2.4787657763551487, 1.4183896779805096], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 470, 0, 0.0, 44.7553191489362, 7, 1331, 17.0, 91.00000000000034, 148.0, 510.6600000000011, 2.7657308296604035, 3.411575640899274, 1.8612538672419778], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 467, 0, 0.0, 35.830835117773034, 7, 845, 15.0, 88.39999999999998, 128.59999999999997, 296.35999999999984, 2.766653238228394, 3.5913474141863553, 1.3563085210846229], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 462, 0, 0.0, 38.54761904761905, 4, 1625, 10.0, 97.39999999999998, 147.69999999999993, 349.11000000000047, 2.769667939594861, 1.6769473853015762, 1.3631959390193458], "isController": false}]}, function(index, item){
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
    createTable($("#errorsTable"), {"supportsControllersDiscrimination": false, "titles": ["Type of error", "Number of errors", "% in errors", "% in all samples"], "items": []}, function(index, item){
        switch(index){
            case 2:
            case 3:
                item = item.toFixed(2) + '%';
                break;
        }
        return item;
    }, [[1, 1]]);

        // Create top5 errors by sampler
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 10419, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
