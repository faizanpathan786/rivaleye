echo "=== Checking Environment Variables ==="
echo ""
echo "BROWSERLESS_TOKEN:" $([ -z "$BROWSERLESS_TOKEN" ] && echo "MISSING" || echo "SET")
echo "TWITTER_AUTH_TOKEN:" $([ -z "$TWITTER_AUTH_TOKEN" ] && echo "MISSING" || echo "SET")
echo "TWITTER_CT0:" $([ -z "$TWITTER_CT0" ] && echo "MISSING" || echo "SET")
echo "PRODUCTHUNT_TOKEN:" $([ -z "$PRODUCTHUNT_TOKEN" ] && echo "MISSING" || echo "SET")
echo "X_API_BEARER:" $([ -z "$X_API_BEARER" ] && echo "MISSING" || echo "SET")
echo "APIFY_TOKEN:" $([ -z "$APIFY_TOKEN" ] && echo "MISSING" || echo "SET")
