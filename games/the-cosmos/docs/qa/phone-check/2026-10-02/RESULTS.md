# Phone check

Run date: 2026-10-02

| Target | Check | Result | Detail |
|---|---|---:|---|
| local/iPhone-15-WebKit | load page | PASS |  |
| local/iPhone-15-WebKit | HTML / JS / server build id | PASS |  |
| local/iPhone-15-WebKit | opening scene real movement and skip | PASS |  |
| local/iPhone-15-WebKit | settings panel open via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| local/iPhone-15-WebKit | settings close via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| local/iPhone-15-WebKit | visible buttons respond to real taps | PASS |  |
| local/iPhone-15-WebKit | action button 20 taps and during movement | PASS |  |
| local/Galaxy-S9-Chromium | load page | PASS |  |
| local/Galaxy-S9-Chromium | HTML / JS / server build id | PASS |  |
| local/Galaxy-S9-Chromium | opening scene real movement and skip | PASS |  |
| local/Galaxy-S9-Chromium | settings panel open via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| local/Galaxy-S9-Chromium | settings close via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| local/Galaxy-S9-Chromium | visible buttons respond to real taps | PASS |  |
| local/Galaxy-S9-Chromium | action button 20 taps and during movement | PASS |  |
| live/iPhone-15-WebKit | load page | PASS |  |
| live/iPhone-15-WebKit | HTML / JS / server build id | FAIL | HTML=null, main.js marker missing |
| live/iPhone-15-WebKit | opening scene real movement and skip | PASS |  |
| live/iPhone-15-WebKit | settings panel open via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| live/iPhone-15-WebKit | settings close via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| live/iPhone-15-WebKit | visible buttons respond to real taps | FAIL | tap on “” produced no observed state/UI change |
| live/iPhone-15-WebKit | action button 20 taps and during movement | PASS |  |
| live/Galaxy-S9-Chromium | load page | PASS |  |
| live/Galaxy-S9-Chromium | HTML / JS / server build id | FAIL | HTML=null, main.js marker missing |
| live/Galaxy-S9-Chromium | opening scene real movement and skip | PASS |  |
| live/Galaxy-S9-Chromium | settings panel open via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| live/Galaxy-S9-Chromium | settings close via real tap | FAIL | The expression evaluated to a falsy value:   assert.ok(box)  |
| live/Galaxy-S9-Chromium | visible buttons respond to real taps | FAIL | tap on “” produced no observed state/UI change |
| live/Galaxy-S9-Chromium | action button 20 taps and during movement | PASS |  |
