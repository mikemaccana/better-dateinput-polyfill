(function(DOM, COMPONENT_CLASS, I18N_DAYS, I18N_MONTHS) {
    "use strict";

    var htmlEl = DOM.find("html"),
        ampm = function(pos, neg) { return htmlEl.get("lang") === "en-US" ? pos : neg },
        formatISODate = function(value) { return value.toISOString().split("T")[0] },
        NOT_A_MOBILE_BROWSER = !("orientation" in window); // need to skip mobile/tablet browsers

    DOM.extend("input[type=date]", NOT_A_MOBILE_BROWSER, {
        constructor: function() {
            var calendar = DOM.create("div.{0}>a[unselectable=on]*2+p.{0}-header+table.{0}-days>thead>tr>th[unselectable=on]*7+tbody>tr*6>td*7", [COMPONENT_CLASS + "-calendar"]),
                displayedValue = DOM.create("span.{0}-value", [COMPONENT_CLASS]),
                zIndex = (parseFloat(this.style("z-index")) || 0) + 1,
                offset = this.offset();

            this
                // remove legacy dateinput implementation if it exists
                // also set value to current time to trigger watchers later
                .set({type: "text", value: Date.now()})
                .style("color", this.style("background-color")) /* hide original input text */
                .addClass(COMPONENT_CLASS)
                // handle arrow keys, esc etc.
                .on("keydown", this.onCalendarKeyDown.bind(this, calendar), ["which", "shiftKey"])
                // sync picker visibility on focus/blur
                .on(["focus", "click"], this.onCalendarFocus.bind(this, calendar))
                .on("blur", this.onCalendarBlur.bind(this, calendar))
                .after(calendar, displayedValue);

            calendar
                .on("mousedown", this.onCalendarClick.bind(this, calendar))
                .style({
                    "margin-left": -(calendar.offset().width + offset.width) / 2,
                    "margin-top": offset.height,
                    "z-index": zIndex
                });

            // center displayed value using margin and line-height
            displayedValue
                .style({
                    "width": offset.width,
                    "font": this.style("font"),
                    "margin-left": -offset.width,
                    "line-height": offset.height + "px"
                });

            this.parent("form").on("reset", this.onFormReset.bind(this));
            // FIXME: "undefined" -> "value" after migrating to better-dom 1.7.5
            this.watch("undefined", this.onValueChanged.bind(this, displayedValue,
                calendar.find("p"), calendar.findAll("th"), calendar.findAll("td")));
            // trigger watchers to build the calendar
            this.set(this.get("defaultValue"));
            // display calendar for autofocused elements
            if (this.matches(":focus")) this.fire("focus");
        },
        onValueChanged: function(displayedValue, caption, weekdays, days, value) {
            var year, month, date, iterDate;

            value = new Date(value);

            // display formatted date value for original input
            if (value.getTime()) {
                displayedValue.set(function() {
                    var formattedValue = value.toUTCString();
                    // remove time part
                    return formattedValue.substr(0, formattedValue.indexOf("00:00") - 1);
                });
            } else {
                displayedValue.set("");

                value = new Date();
            }

            month = value.getMonth();
            date = value.getDate();
            year = value.getFullYear();

            // update calendar caption
            caption.i18n(I18N_MONTHS[month], [year]);
            // update calendar weekday captions
            weekdays.each(function(el, index) {
                el.i18n(I18N_DAYS[ampm(index ? index - 1 : 6, index)]);
            });
            // update calendar content
            iterDate = new Date(year, month, 0, 12);
            // move to beginning of current month week
            iterDate.setDate(iterDate.getDate() - iterDate.getDay() - ampm(1, 0));
            // update day numbers
            days.set("class", function(day) {
                iterDate.setDate(iterDate.getDate() + 1);

                var mDiff = month - iterDate.getMonth(),
                    dDiff = date - iterDate.getDate();

                if (year !== iterDate.getFullYear()) mDiff *= -1;

                day.set("_ts", iterDate.getTime()).set(iterDate.getDate());

                return mDiff ?
                    (mDiff > 0 ? COMPONENT_CLASS + "-calendar-past" : COMPONENT_CLASS + "-calendar-future") :
                    (dDiff ? "" :  COMPONENT_CLASS + "-calendar-today");
            });
        },
        onCalendarClick: function(calendar, target) {
            var targetDate;

            if (target == "a") {
                targetDate = new Date(this.get());

                if (!targetDate.getTime()) targetDate = new Date();

                targetDate.setMonth(targetDate.getMonth() + (target.next("a").length ? -1 : 1));
            } else if (target == "td") {
                targetDate = new Date(target.get("_ts"));
                calendar.hide();
            }

            if (targetDate != null) this.set(formatISODate(targetDate));
            // prevent input from loosing focus
            return false;
        },
        onCalendarKeyDown: function(calendar, which, shiftKey) {
            var delta, currentDate;

            // ENTER key should submit form if calendar is hidden
            if (calendar.matches(":hidden") && which === 13) return true;

            if (which === 32) {
                calendar.toggle(); // SPACE key toggles calendar visibility
            } else if (which === 27 || which === 9 || which === 13) {
                calendar.hide(); // ESC, TAB or ENTER keys hide calendar
            } else if (which === 8 || which === 46) {
                this.set(""); // BACKSPACE, DELETE clear value
            } else {
                currentDate = new Date(this.get());

                if (!currentDate.getTime()) currentDate = new Date();

                if (which === 74 || which === 40) { delta = 7; }
                else if (which === 75 || which === 38) { delta = -7; }
                else if (which === 76 || which === 39) { delta = 1; }
                else if (which === 72 || which === 37) { delta = -1; }

                if (delta) {
                    if (shiftKey && (which === 40 || which === 38)) {
                        currentDate.setFullYear(currentDate.getFullYear() + (delta > 0 ? 1 : -1));
                    } else if (shiftKey && (which === 37 || which === 39)) {
                        currentDate.setMonth(currentDate.getMonth() + (delta > 0 ? 1 : -1));
                    } else {
                        currentDate.setDate(currentDate.getDate() + delta);
                    }

                    this.set(formatISODate(currentDate));
                }
            }
            // prevent default action except if it was TAB so
            // do not allow to change the value manually
            return which === 9;
        },
        onCalendarBlur: function(calendar) {
            calendar.hide();
        },
        onCalendarFocus: function(calendar) {
            calendar.show(function() {
                // FIXME: remove after migrating to better-dom 1.7.5
                calendar.style("pointer-events", null);
            });
        },
        onFormReset: function() {
            // TODO: will be removed in future implementation of the
            // watch method, for now need to trigger watchers manually
            this.set(this.get("defaultValue"));
        }
    });
}(window.DOM, "better-dateinput", [
    "Mo",
    "Tu",
    "We",
    "Th",
    "Fr",
    "Sa",
    "Su"
], [
    "January {0}",
    "February {0}",
    "March {0}",
    "April {0}",
    "May {0}",
    "June {0}",
    "July {0}",
    "August {0}",
    "September {0}",
    "October {0}",
    "November {0}",
    "December {0}"
]));
