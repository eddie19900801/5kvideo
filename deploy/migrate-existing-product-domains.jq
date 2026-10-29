.productDomains = ["wflhc.cn"]
| .productLines |= map(
    (.slug + ".app.wflhc.cn") as $new
    | (.publishedConfig.domain // .domain) as $old
    | .domain = $new
    | .domains = [$new]
    | if .publishedConfig then
        .publishedConfig.domain = $new
        | .publishedConfig.domains = ([$new, $old] | map(select(. != null and . != "")) | unique)
      else . end
  )
