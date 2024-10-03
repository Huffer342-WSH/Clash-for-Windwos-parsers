module.exports.parse = async (raw, { axios, yaml, notify, console }, { name, url, interval, selected }) => {
    const obj = yaml.parse(raw)
    //////////////////////   DNS  //////////////////////
    if (!obj.hasOwnProperty("dns")) {
        obj["dns"] = {};
    }

    if (!obj.dns.hasOwnProperty("default-nameserver")) {
        obj.dns["default-nameserver"] = [];
    }
    obj.dns["default-nameserver"].splice(0, 1, "223.5.5.5")
    obj.dns["default-nameserver"].splice(1, 1, "119.29.29.29")

    if (!obj.dns.hasOwnProperty("nameserver")) {
        obj.dns["nameserver"] = [];
    }
    obj.dns["nameserver"].splice(0, 1, "https://doh.pub/dns-query")
    obj.dns["nameserver"].splice(1, 1, "https://dns.alidns.com/dns-query")

    if (!obj.dns.hasOwnProperty("fallback")) {
        obj.dns["fallback"] = [];
    }
    obj.dns["fallback"].splice(0, 1, "https://1.1.1.1/dns-query")
    obj.dns["fallback"].splice(1, 1, "https://208.67.222.222/dns-query")

    if (!obj.dns.hasOwnProperty("fallback-filter")) {
        obj.dns["fallback-filter"] = {};
    }
    const fallback_filter = {
        geoip: true,
        "geoip-code": 'CN',
        ipcidr: ['240.0.0.0/4', '0.0.0.0/32']
    };
    obj.dns["fallback-filter"] = fallback_filter

    //////////////////////   Proxy Group  //////////////////////
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

    if (!obj.hasOwnProperty("proxy-groups")) {
        obj["proxy-groups"] = [];
    }
    //节点名称分组
    const proxiesRAW = obj.proxies.map(proxy => proxy.name);
    const proxiesUseful = proxiesRAW.filter(proxy => {
        return !proxy.includes('剩余') && !proxy.includes('套餐') && !proxy.includes('网址') && !proxy.includes('客服');
    });

    const proxiesCountry = [];//用于保存各个国家节点组的名称

    // 生成各个国家的节点组
    addProxyGroup(obj, proxiesCountry, '节点组-美国', ['美国', 'US'])
    addProxyGroup(obj, proxiesCountry, '节点组-香港', ['香港', 'HK']);
    addProxyGroup(obj, proxiesCountry, '节点组-台湾', ['台湾', 'TW']);
    addProxyGroup(obj, proxiesCountry, '节点组-日本', ['日本', 'JP']);
    addProxyGroup(obj, proxiesCountry, '节点组-韩国', ['韩国', 'KR']);
    addProxyGroup(obj, proxiesCountry, '节点组-澳大利亚', ['澳大利亚', 'AU']);
    addProxyGroup(obj, proxiesCountry, '节点组-新加坡', ['新加坡', 'SG']);
    addProxyGroup(obj, proxiesCountry, '节点组-法国', ['法国', 'FR']);
    addProxyGroup(obj, proxiesCountry, '节点组-英国', ['英国', 'UK']);
    addProxyGroup(obj, proxiesCountry, '节点组-德国', ['德国', 'DE']);
    addProxyGroup(obj, proxiesCountry, '节点组-意大利', ['意大利', 'IT']);
    addProxyGroup(obj, proxiesCountry, '节点组-俄罗斯', ['俄罗斯', 'RU']);

    const proxiesDefault = ['默认代理', 'DIRECT', ...proxiesCountry, ...proxiesUseful];
    const proxiesChatgpt = proxiesUseful.filter(proxy => !proxy.includes('香港')); //GPT节点组排除香港

    //AA默认代理-自动选择
    const proxyGroup_autoSelect_Default = {
        name: 'AA默认代理-自动选择',
        type: 'url-test',
        proxies: proxiesUseful,
        url: 'http://www.gstatic.com/generate_204',
        interval: 86400
    };
    obj['proxy-groups'].push(proxyGroup_autoSelect_Default);

    // 默认代理
    const proxyGroup_default = {
        name: '默认代理',
        type: 'select',
        proxies: ['AA默认代理-自动选择', 'DIRECT', ...proxiesCountry, ...proxiesRAW]
    };
    obj['proxy-groups'].splice(0, 0, proxyGroup_default);

    //chatgpt
    const proxyGroup_ChatGPT = {
        name: 'chatgpt',
        type: 'select',
        proxies: [...proxiesChatgpt]
    };
    obj['proxy-groups'].splice(1, 0, proxyGroup_ChatGPT);

    const proxyGroup_bing = {
        name: 'bing',
        type: 'select',
        proxies: [...proxiesChatgpt]
    };
    obj['proxy-groups'].splice(2, 0, proxyGroup_bing);

    const proxyGroup_battle = {
        name: '战网',
        type: 'select',
        proxies: proxiesDefault,
    };
    obj['proxy-groups'].splice(3, 0, proxyGroup_battle);

    const proxyGroup_Apple = {
        name: '苹果服务',
        type: 'select',
        proxies: proxiesDefault,
    };
    obj['proxy-groups'].splice(4, 0, proxyGroup_Apple);

    const proxyGroup_Microsoft = {
        name: '微软服务',
        type: 'select',
        proxies: proxiesDefault,
    };
    obj['proxy-groups'].splice(5, 0, proxyGroup_Microsoft);

    const proxyGroup_match = {
        name: '漏网之鱼',
        type: 'select',
        proxies: proxiesDefault,
    };
    obj['proxy-groups'].splice(6, 0, proxyGroup_match);



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

    obj['rule-providers'] = obj['rule-providers'] || {};
    Object.assign(obj['rule-providers'], newRuleProviders);


    //////////////////////  rules  //////////////////////
    const newRules = [
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
        'DOMAIN-SUFFIX,pling.com,默认代理',
        'DOMAIN-SUFFIX,gnome-look.org,默认代理',
        'DOMAIN,Filters.adtidy.org,默认代理',
        'DOMAIN-SUFFIX,gitkraken.com,默认代理',
        'DOMAIN-SUFFIX,nodejs.org,默认代理',
        'DOMAIN-SUFFIX,npmjs.org,默认代理',
        // 'DOMAIN,cdn.xiaolincoding.com,默认代理',
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
        'DOMAIN-SUFFIX,cloudflarestorage.com,DIRECT',
        'DOMAIN,xilinx-ax-dl.entitlenow.com,DIRECT',
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
    obj['rules'] = newRules;
    // obj['rules'] = obj['rules'] || [];
    // obj['rules'].unshift(...newRules);

    return yaml.stringify(obj)
}
