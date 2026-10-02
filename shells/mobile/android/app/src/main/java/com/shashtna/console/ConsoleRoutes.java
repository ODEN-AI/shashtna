package com.shashtna.console;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * The Console deep-link table, read from the generated asset
 * console-routes.txt (scripts/console-routes.ts ← src/lib/console-links.ts).
 * The routes are never written by hand on the native side. Pure Java.
 */
public final class ConsoleRoutes {
    public final String origin;
    public final String scheme;
    public final List<String> patterns;
    public final Set<String> queryKeys;

    private ConsoleRoutes(String origin, String scheme, List<String> patterns, Set<String> queryKeys) {
        this.origin = origin;
        this.scheme = scheme;
        this.patterns = Collections.unmodifiableList(patterns);
        this.queryKeys = Collections.unmodifiableSet(queryKeys);
    }

    public static ConsoleRoutes parse(String text) {
        String origin = null;
        String scheme = null;
        List<String> patterns = new ArrayList<>();
        Set<String> keys = new LinkedHashSet<>();

        for (String raw : text.split("\n")) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            int space = line.indexOf(' ');
            if (space < 0) continue;
            String kind = line.substring(0, space);
            String value = line.substring(space + 1).trim();
            switch (kind) {
                case "origin": origin = value; break;
                case "scheme": scheme = value; break;
                case "route": patterns.add(value); break;
                case "query": keys.add(value); break;
                default: break;
            }
        }

        if (origin == null || scheme == null || patterns.isEmpty()) {
            throw new IllegalArgumentException("console-routes: missing origin, scheme or routes");
        }
        return new ConsoleRoutes(origin, scheme, patterns, keys);
    }
}
