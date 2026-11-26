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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9720115786040444, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9992650661440471, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [0.9995222169135213, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [0.9983148772267694, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9990181639666176, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.9991365841624866, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [1.0, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [0.9991308666501117, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [0.999544739673868, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.11030061892130857, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [0.9997609942638623, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [1.0, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [1.0, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9992732558139535, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [0.9987816764132553, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [0.9997529644268774, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 73584, 0, 0.0, 334.46579419438973, 2, 14835, 17.0, 45.0, 64.0, 14177.980000000003, 397.2810564790869, 849.0000561834909, 125.36228755722955], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 12246, 0, 0.0, 21.388371713212457, 2, 536, 12.0, 41.0, 59.0, 158.18000000000393, 68.37979094076654, 307.70905923344947, 14.958079268292684], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 2093, 0, 0.0, 23.02580028666984, 5, 625, 16.0, 41.0, 54.0, 111.0, 11.779802675641754, 12.130152036771783, 5.498835536183637], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 2093, 0, 0.0, 21.5456282847587, 5, 350, 15.0, 37.600000000000136, 53.0, 98.17999999999984, 11.780001575919943, 11.762231803401173, 5.533440106599727], "isController": false}, {"data": ["S07 Medications GET /api/medications", 2077, 0, 0.0, 32.401540683678505, 5, 12858, 18.0, 45.0, 61.0, 128.6599999999994, 11.755516942773216, 14.276700052141406, 5.705608260981532], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 2037, 0, 0.0, 28.0324005891016, 5, 587, 20.0, 46.0, 60.09999999999991, 216.23999999999978, 11.73211385391589, 10.517763621591811, 5.923449504970454], "isController": false}, {"data": ["B2 Login page /login", 12161, 0, 0.0, 21.048022366581687, 2, 742, 11.0, 41.0, 58.0, 168.3799999999992, 68.38630586859212, 184.3892485382645, 15.293421917878511], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 2037, 0, 0.0, 23.901816396661747, 5, 469, 17.0, 41.0, 52.09999999999991, 124.61999999999989, 11.731911143875735, 13.6338707909537, 6.015002714120337], "isController": false}, {"data": ["B3 Signup page /signup", 12081, 0, 0.0, 21.442181938581143, 2, 670, 11.0, 41.0, 58.0, 182.0, 68.29397898211954, 209.88393736008808, 15.339467935437007], "isController": false}, {"data": ["B4 API ready /api/health/ready", 12081, 0, 0.0, 17.51113318433897, 3, 769, 12.0, 31.0, 42.0, 96.0, 68.28934650017806, 34.47811732479693, 16.005315585979233], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 2262, 0, 0.0, 10183.905393457115, 192, 14835, 12843.0, 14135.1, 14299.55, 14579.07, 12.280930353768975, 12.250332583080874, 4.269542193302495], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 2092, 0, 0.0, 26.611376673040148, 6, 532, 21.0, 47.0, 63.34999999999991, 103.0, 11.787509297031711, 15.333130650411887, 5.755685803996033], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 2092, 0, 0.0, 21.24235181644361, 4, 326, 15.0, 38.0, 52.34999999999991, 99.07000000000016, 11.788306360726683, 9.555040916749313, 5.583394730762295], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 2092, 0, 0.0, 25.54684512428294, 5, 490, 19.0, 46.0, 59.0, 120.21000000000049, 11.78790781540542, 10.56774120273849, 5.951578083619767], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 2064, 0, 0.0, 29.284399224806187, 7, 571, 21.0, 50.0, 66.75, 139.3499999999981, 11.71875, 15.169393184573153, 7.868062618166902], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 2052, 0, 0.0, 33.33333333333333, 6, 6543, 22.0, 51.0, 70.0, 143.76000000000022, 11.71821462835214, 15.522336909734912, 5.721840254380054], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 2024, 0, 0.0, 18.815217391304387, 4, 724, 13.0, 34.0, 44.0, 92.25, 11.699827739690393, 7.09530568979271, 5.735815801415078], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 73584, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
