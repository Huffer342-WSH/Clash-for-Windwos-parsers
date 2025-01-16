module.exports.parse = async (raw, { axios, yaml, notify, console }, { name, url, interval, selected }) => {
    const obj = yaml.parse(raw)
    const newobj = {}
    //======================  开关 ======================
    const enable_replace_rules = true

    //======================  固定配置 ======================
    newobj["mixed-port"] = 7890;
    newobj["allow-lan"] = true;
    newobj["bind-address"] = "*";
    newobj["mode"] = "rule";
    newobj["log-level"] = "info";
    newobj["external-controller"] = "127.0.0.1:9090";
    newobj["dns"] = {
        enable: true,
        ipv6: false,
        "default-nameserver": ["223.5.5.5", "119.29.29.29"],
        "enhanced-mode": "fake-ip",
        "fake-ip-range": "198.18.0.1/16",
        "use-hosts": true,
        nameserver: [
            "https://doh.pub/dns-query",
            "https://dns.alidns.com/dns-query",
        ],
        fallback: [
            "https://1.1.1.1/dns-query",
            "https://208.67.222.222/dns-query",
            "https://dns.twnic.tw/dns-query",
            "tls://8.8.4.4:853",
        ],
        "fallback-filter": {
            geoip: true,
            "geoip-code": "CN",
            ipcidr: ["240.0.0.0/4", "0.0.0.0/32"],
        },
    };

    //======================  proxies ======================
    newobj["proxies"] = obj["proxies"]

    //======================  Proxy Group ======================
    newobj['proxy-groups'] = []
    function createProxyGroups(obj, name, auxStrings) {
        // 直接在 filter 中提取 name 属性并过滤
        const proxyNames = obj.proxies
            .map(proxy => proxy.name)
            .filter(proxyName => auxStrings.some(aux => proxyName.includes(aux)));

        if (proxyNames.length > 0) {
            // 创建自动选择组
            const autoProxyGroup = {
                name: `${name}-自动选择`,
                type: 'url-test',
                proxies: proxyNames,
                url: 'http://www.gstatic.com/generate_204',
                interval: 86400
            };

            // 创建选择组
            const proxyGroup = {
                name: name,
                type: 'select',
                proxies: [`${name}-自动选择`, ...proxyNames]
            };

            // 返回这两个组
            return { autoProxyGroup, proxyGroup };
        }

        // 如果没有找到符合条件的代理，返回 null
        return null;
    }

    function addProxyGroup(obj, listCountry, name, auxStrings) {
        const groupTemp = createProxyGroups(obj, name, auxStrings);
        if (groupTemp) {
            const { autoProxyGroup, proxyGroup } = groupTemp;
            obj['proxy-groups'].push(autoProxyGroup, proxyGroup);
            listCountry.push(name);
        }
    }

    //节点名称分组

    // 所有节点
    const proxiesRAW = newobj.proxies.map(proxy => proxy.name);

    // 有效节点
    const proxiesUseful = proxiesRAW.filter(proxy => {
        return !proxy.includes('剩余') && !proxy.includes('套餐') && !proxy.includes('网址') && !proxy.includes('客服');
    });

    // 生成各个国家的节点组
    const proxiesCountries = [];//用于保存各个国家节点组的名称
    const proxyMatcher = [
        { name: '节点组-美国', match: ['美国', 'US', '🇺🇸'] },
        { name: '节点组-香港', match: ['香港', 'HK', '🇭🇰'] },
        { name: '节点组-台湾', match: ['台湾', 'TW'] },
        { name: '节点组-日本', match: ['日本', 'JP'] },
        { name: '节点组-韩国', match: ['韩国', 'KR'] },
        { name: '节点组-澳大利亚', match: ['澳大利亚', 'AU'] },
        { name: '节点组-新加坡', match: ['新加坡', 'SG'] },
        { name: '节点组-法国', match: ['法国', 'FR'] },
        { name: '节点组-英国', match: ['英国', 'UK'] },
        { name: '节点组-德国', match: ['德国', 'DE'] },
        { name: '节点组-意大利', match: ['意大利', 'IT'] },
        { name: '节点组-俄罗斯', match: ['俄罗斯', 'RU'] },
    ];

    // 遍历数组调用 addProxyGroup
    proxyMatcher.forEach(group => {
        addProxyGroup(newobj, proxiesCountries, group.name, group.match);
    });

    const proxiesDefault = ['默认代理', 'DIRECT', ...proxiesCountries, ...proxiesUseful];
    const proxiesChatgpt = proxiesUseful.filter(proxy => !proxy.includes('香港')); //GPT节点组排除香港

    const proxyGroupConfigs = [
        {
            name: '自动选择',
            type: 'url-test',
            proxies: proxiesUseful,
            url: 'http://www.gstatic.com/generate_204',
            interval: 86400,
        },
        {
            name: '默认代理',
            type: 'select',
            proxies: ['自动选择', 'DIRECT', ...proxiesCountries, ...proxiesRAW],
        },
        { name: 'chatgpt', type: 'select', proxies: [...proxiesChatgpt] },
        { name: 'bing', type: 'select', proxies: [...proxiesChatgpt] },
        { name: '战网', type: 'select', proxies: proxiesDefault },
        { name: '苹果服务', type: 'select', proxies: proxiesDefault },
        { name: '微软服务', type: 'select', proxies: proxiesDefault },
        { name: '漏网之鱼', type: 'select', proxies: proxiesDefault },
    ];

    newobj['proxy-groups'].unshift(...proxyGroupConfigs);




    //////////////////////   Rule Providers  //////////////////////
    const newRuleProviders = {
        'reject': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/reject.txt',
            path: './ruleset/reject.yaml',
            interval: 86400
        },
        'icloud': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/icloud.txt',
            path: './ruleset/icloud.yaml',
            interval: 86400
        },
        'apple': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/apple.txt',
            path: './ruleset/apple.yaml',
            interval: 86400
        },
        'google': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/google.txt',
            path: './ruleset/google.yaml',
            interval: 86400
        },
        'proxy': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/proxy.txt',
            path: './ruleset/proxy.yaml',
            interval: 86400
        },
        'direct': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/direct.txt',
            path: './ruleset/direct.yaml',
            interval: 86400
        },
        'private': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/private.txt',
            path: './ruleset/private.yaml',
            interval: 86400
        },
        'gfw': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/gfw.txt',
            path: './ruleset/gfw.yaml',
            interval: 86400
        },
        'tld-not-cn': {
            type: 'http',
            behavior: 'domain',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/tld-not-cn.txt',
            path: './ruleset/tld-not-cn.yaml',
            interval: 86400
        },
        'telegramcidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/telegramcidr.txt',
            path: './ruleset/telegramcidr.yaml',
            interval: 86400
        },
        'cncidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/cncidr.txt',
            path: './ruleset/cncidr.yaml',
            interval: 86400
        },
        'lancidr': {
            type: 'http',
            behavior: 'ipcidr',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/lancidr.txt',
            path: './ruleset/lancidr.yaml',
            interval: 86400
        },
        'applications': {
            type: 'http',
            behavior: 'classical',
            url: 'https://cdn.jsdelivr.net/gh/Loyalsoldier/clash-rules@release/applications.txt',
            path: './ruleset/applications.yaml',
            interval: 86400
        },
        'Microsoft': {
            type: 'http',
            behavior: 'classical',
            url: "https://cdn.jsdelivr.net/gh/zhanyeye/clash-rules-lite@release/microsoft-rules.txt",
            path: './providers/rule-microsoft.yaml',
            interval: 86400
        }
    };

    newobj['rule-providers'] = newRuleProviders;


    //////////////////////  rules  //////////////////////
    const newRules = [
        // 局域网
        'IP-CIDR,10.0.0.0/8,DIRECT,no-resolve',
        'IP-CIDR,172.16.0.0/12,DIRECT,no-resolve',
        'IP-CIDR,192.168.0.0/16,DIRECT,no-resolve',
        'IP-CIDR,127.0.0.1/32,DIRECT,no-resolve',

        //Matlab
        'PROCESS-NAME,MathWorksProductInstaller.exe,DIRECT',
        'PROCESS-NAME,MATLABWindow.exe,DIRECT',
        'DOMAIN,esd.mathworks.com,DIRECT',
        'DOMAIN-SUFFIX,mathworks.com,默认代理',

        //steam
        'DOMAIN-KEYWORD,steamcloud,默认代理',
        'DOMAIN,api.steampowered.com,默认代理',
        'PROCESS-NAME,steamwebhelper.exe,默认代理',
        'PROCESS-NAME,steam.exe,DIRECT',

        //默认代理 
        'PROCESS-NAME,Clash for Windows.exe,默认代理',
        'PROCESS-NAME,cfw,默认代理',
        'DOMAIN,esm.ubuntu.com,默认代理',
        'DOMAIN,ppa.launchpad.net,默认代理',
        'DOMAIN-SUFFIX,cloudflarestorage.com,默认代理',
        'DOMAIN,adaptivesupport.amd.com,默认代理',
        'DOMAIN-SUFFIX,pling.com,默认代理',
        'DOMAIN-SUFFIX,gnome-look.org,默认代理',
        'DOMAIN,Filters.adtidy.org,默认代理',
        'DOMAIN-SUFFIX,gitkraken.com,默认代理',
        'DOMAIN-SUFFIX,nodejs.org,默认代理',
        'DOMAIN-SUFFIX,npmjs.org,默认代理',
        'DOMAIN,cdn.xiaolincoding.com,默认代理',
        'DOMAIN,linuxmirrors.cn,默认代理',
        'DOMAIN,support.xilinx.com,默认代理',
        'DOMAIN,docs.amd.com,默认代理',
        'DOMAIN,fba02.fbva-ho0.cc,默认代理',
        'DOMAIN,amazonaws.com,默认代理',
        'DOMAIN,pypi.org,默认代理',
        'DOMAIN,conda.anaconda.org,默认代理',
        'DOMAIN,www.freertos.org,默认代理',
        'DOMAIN,katex.org,默认代理',
        'DOMAIN,ieeexplore.ieee.org,默认代理',
        'DOMAIN,jichangtuijian.com,默认代理',
        'DOMAIN,plotly.com,默认代理',
        'DOMAIN-SUFFIX,gardenparty.one,默认代理',
        'DOMAIN-SUFFIX,ppgnginx.com,默认代理',
        'DOMAIN-SUFFIX,itzmx.com,默认代理',
        'DOMAIN-SUFFIX,epicgames.com,默认代理',
        'PROCESS-NAME,qbittorrent.exe,默认代理',
        'PROCESS-NAME,fdm.exe,默认代理',
        'DOMAIN-SUFFIX,pythonhosted.org,默认代理',
        'DOMAIN-SUFFIX,codeium.com,默认代理',
        'DOMAIN-SUFFIX,hp.com,默认代理',
        'DOMAIN-SUFFIX,acg.rip,默认代理',
        'DOMAIN-SUFFIX,sublimetext.com,默认代理',
        'DOMAIN-SUFFIX,zmyos.com,默认代理',

        // DIRECT
        'DOMAIN-SUFFIX,entitlenow.com,DIRECT',
        'DOMAIN-SUFFIX,cn.mm.bing.net,DIRECT',
        'DOMAIN,www.bing.com,DIRECT',
        'DOMAIN,cn.bing.com,DIRECT',
        'DOMAIN-KEYWORD,starrycoding,DIRECT',
        'DOMAIN-KEYWORD,eriktse,DIRECT',
        'DOMAIN,oi-wiki.org,DIRECT',
        'DOMAIN,download.epicgames.com,DIRECT',
        'DOMAIN,fastly-download.epicgames.com,DIRECT',
        'DOMAIN,www.asasmr3.com,DIRECT',
        'DOMAIN,cdn2.asmrfx.com,DIRECT',
        'DOMAIN,tx.asmras.net,DIRECT',
        'DOMAIN-KEYWORD,asasmr,DIRECT',
        'DOMAIN,clash.razord.top,DIRECT',
        'DOMAIN,yacd.haishan.me,DIRECT',

        //chatgpt
        'DOMAIN,challenges.cloudflare.com,chatgpt',
        'DOMAIN-SUFFIX,chatgpt.com,chatgpt',
        'DOMAIN-SUFFIX,openai.com,chatgpt',
        'DOMAIN,cdn.oaistatic.com,chatgpt',
        'DOMAIN,ccdn.auth0.com,chatgpt',
        'DOMAIN,s.gravatar.com,chatgpt',
        'DOMAIN-KEYWORD,gemini,chatgpt',
        'DOMAIN-KEYWORD,claude,chatgpt',
        'DOMAIN,plausible.midway.run,chatgpt',

        //Bing Copilot
        'DOMAIN-SUFFIX,bing.com,bing',
        'DOMAIN-KEYWORD,copilot,bing',
        'DOMAIN-SUFFIX,bingapis.com,bing',
        'DOMAIN-SUFFIX,bingparachute.com,bing',

        // 战网
        'PROCESS-NAME,Battle.net.exe,战网',
        'DOMAIN,telemetry-in.battle.net,战网',

        // ruleset
        // 'RULE-SET,applications,DIRECT',
        'RULE-SET,private,DIRECT',
        'RULE-SET,direct,DIRECT',
        'RULE-SET,reject,REJECT',
        'RULE-SET,apple,苹果服务',
        'RULE-SET,Microsoft,微软服务',
        'RULE-SET,tld-not-cn,默认代理',
        'RULE-SET,gfw,默认代理',
        'RULE-SET,telegramcidr,默认代理',
        'GEOIP,CN,DIRECT',

        'MATCH,漏网之鱼'
    ];
    if (enable_replace_rules) {
        newobj['rules'] = newRules;
    } else {
        newobj["rules"] = [...newRules, ...obj["rules"]];
    }

    return yaml.stringify(newobj)
}
