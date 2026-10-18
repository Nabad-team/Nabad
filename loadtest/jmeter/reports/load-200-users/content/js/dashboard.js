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
    createTable($("#apdexTable"), {"supportsControllersDiscrimination": true, "overall": {"data": [0.9665316563632488, 500, 1500, "Total"], "isController": false}, "titles": ["Apdex", "T (Toleration threshold)", "F (Frustration threshold)", "Label"], "items": [{"data": [0.9998980008159934, 500, 1500, "B1 Landing page /"], "isController": false}, {"data": [1.0, 500, 1500, "S02 Dashboard GET /api/auth/me"], "isController": false}, {"data": [1.0, 500, 1500, "S03 Dashboard GET /api/profile/me"], "isController": false}, {"data": [1.0, 500, 1500, "S07 Medications GET /api/medications"], "isController": false}, {"data": [0.9996632996632997, 500, 1500, "S10 Water and sleep GET /api/wellbeing/today"], "isController": false}, {"data": [0.999794661190965, 500, 1500, "B2 Login page /login"], "isController": false}, {"data": [1.0, 500, 1500, "S11 Water and sleep GET /api/wellbeing/history"], "isController": false}, {"data": [1.0, 500, 1500, "B3 Signup page /signup"], "isController": false}, {"data": [1.0, 500, 1500, "B4 API ready /api/health/ready"], "isController": false}, {"data": [0.19904153354632587, 500, 1500, "S01 Log in POST /api/auth/login"], "isController": false}, {"data": [1.0, 500, 1500, "S06 Dashboard GET /api/health-profile"], "isController": false}, {"data": [1.0, 500, 1500, "S04 Dashboard GET /api/profile/linked"], "isController": false}, {"data": [1.0, 500, 1500, "S05 Dashboard GET /api/wellbeing/today"], "isController": false}, {"data": [0.9996657754010695, 500, 1500, "S08 Add medication POST /api/medications"], "isController": false}, {"data": [1.0, 500, 1500, "S09 My health GET /api/health-profile"], "isController": false}, {"data": [1.0, 500, 1500, "S12 Log out POST /api/auth/logout"], "isController": false}]}, function(index, item){
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
    createTable($("#statisticsTable"), {"supportsControllersDiscrimination": true, "overall": {"data": ["Total", 37528, 0, 0.0, 123.82431784267762, 3, 6149, 12.0, 40.0, 98.0, 4020.9900000000016, 207.47342175242287, 324.6787327977372, 73.52394646722155], "isController": false}, "titles": ["Label", "#Samples", "FAIL", "Error %", "Average", "Min", "Max", "Median", "90th pct", "95th pct", "99th pct", "Transactions/s", "Received", "Sent"], "items": [{"data": ["B1 Landing page /", 4902, 0, 0.0, 12.774581803345566, 3, 652, 8.0, 18.0, 28.0, 106.91000000000076, 27.34544967700907, 92.45111990410683, 5.981817116845734], "isController": false}, {"data": ["S02 Dashboard GET /api/auth/me", 1516, 0, 0.0, 22.54617414248023, 6, 464, 14.0, 38.0, 55.149999999999864, 167.97999999999956, 8.579416192233252, 8.595316240407579, 4.021601340109337], "isController": false}, {"data": ["S03 Dashboard GET /api/profile/me", 1516, 0, 0.0, 21.21833773087071, 6, 334, 13.0, 36.0, 55.0, 164.3199999999997, 8.580678756593992, 8.571442437357083, 4.047331874448143], "isController": false}, {"data": ["S07 Medications GET /api/medications", 1509, 0, 0.0, 25.482438701126604, 7, 455, 16.0, 43.0, 60.0, 228.0000000000009, 8.569140871224382, 10.922757592406457, 4.175782514395475], "isController": false}, {"data": ["S10 Water and sleep GET /api/wellbeing/today", 1485, 0, 0.0, 27.32996632996633, 7, 605, 19.0, 45.0, 66.70000000000005, 191.9600000000014, 8.577171439463076, 7.597162593352548, 4.347218727618492], "isController": false}, {"data": ["B2 Login page /login", 4870, 0, 0.0, 12.017248459958934, 3, 562, 8.0, 18.0, 27.0, 88.28999999999996, 27.27939817278446, 53.653035078113184, 6.10056853668715], "isController": false}, {"data": ["S11 Water and sleep GET /api/wellbeing/history", 1485, 0, 0.0, 21.808080808080838, 6, 243, 15.0, 38.0, 57.0, 140.7000000000005, 8.578509245726632, 9.994298369288938, 4.414916379392515], "isController": false}, {"data": ["B3 Signup page /signup", 4836, 0, 0.0, 12.210918114143961, 3, 452, 8.0, 18.0, 28.0, 99.0, 27.18258875373789, 64.05428385036086, 6.1054642708590965], "isController": false}, {"data": ["B4 API ready /api/health/ready", 4834, 0, 0.0, 14.602192800992997, 3, 405, 8.0, 25.0, 39.0, 125.64999999999964, 27.17730464555375, 13.69481366904857, 6.36968077630166], "isController": false}, {"data": ["S01 Log in POST /api/auth/login", 1565, 0, 0.0, 2560.7987220447285, 271, 6149, 2761.0, 4264.0, 4759.999999999996, 5909.079999999999, 8.694347840579548, 8.676509497116697, 3.022644366451484], "isController": false}, {"data": ["S06 Dashboard GET /api/health-profile", 1516, 0, 0.0, 22.06068601583114, 7, 266, 16.5, 38.0, 51.0, 98.0, 8.580970170374144, 10.966890291574687, 4.206686548367013], "isController": false}, {"data": ["S04 Dashboard GET /api/profile/linked", 1516, 0, 0.0, 19.750659630606837, 6, 302, 14.0, 34.0, 51.0, 111.48999999999978, 8.58111588468701, 6.963776660327056, 4.081058042815013], "isController": false}, {"data": ["S05 Dashboard GET /api/wellbeing/today", 1516, 0, 0.0, 23.765171503957777, 8, 409, 17.0, 42.0, 58.149999999999864, 102.65999999999985, 8.58082446100989, 7.600398228648407, 4.349070210218879], "isController": false}, {"data": ["S08 Add medication POST /api/medications", 1496, 0, 0.0, 29.123663101604304, 9, 585, 20.0, 45.0, 67.14999999999986, 212.08999999999992, 8.523342335259061, 10.515136357097278, 5.737403446512609], "isController": false}, {"data": ["S09 My health GET /api/health-profile", 1491, 0, 0.0, 27.197183098591555, 8, 451, 18.0, 46.0, 69.0, 218.79999999999927, 8.549409970297823, 11.07930701255175, 4.191214653407723], "isController": false}, {"data": ["S12 Log out POST /api/auth/logout", 1475, 0, 0.0, 18.400677966101668, 5, 407, 11.0, 29.0, 45.40000000000009, 177.24, 8.565472146246, 5.186125713547383, 4.2158183219804535], "isController": false}]}, function(index, item){
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
    createTable($("#top5ErrorsBySamplerTable"), {"supportsControllersDiscrimination": false, "overall": {"data": ["Total", 37528, 0, "", "", "", "", "", "", "", "", "", ""], "isController": false}, "titles": ["Sample", "#Samples", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors", "Error", "#Errors"], "items": [{"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}, {"data": [], "isController": false}]}, function(index, item){
        return item;
    }, [[0, 0]], 0);

});
