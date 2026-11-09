window.__ModuleLoader__.load({
  id: 'dsh-think-zh',
  factory(require) {
    const React = require('react');
    const h = React.createElement;
    const { useCallback, useEffect, useMemo, useState } = React;

    const API = '/api/think-zh';

    const C = {
      text: 'var(--dsw-alias-label-primary, #e8e8e8)',
      sub: 'var(--dsw-alias-label-tertiary, #9a9a9a)',
      line: 'var(--dsw-alias-border-l2, rgba(128,128,128,.28))',
      card: 'var(--dsw-alias-bg-l2, rgba(128,128,128,.08))',
      accent: 'var(--dsw-alias-state-business-primary, #4d8dff)',
    };

    const TAP = 40;

    const box = {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      width: '100%',
      maxWidth: 720,
      boxSizing: 'border-box',
      color: C.text,
      fontSize: 14,
      lineHeight: '21px',
      WebkitTapHighlightColor: 'transparent',
      paddingBottom: 'env(safe-area-inset-bottom, 0px)',
    };
    const card = {
      border: `0.5px solid ${C.line}`,
      borderRadius: 10,
      padding: '12px 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      background: C.card,
      boxSizing: 'border-box',
      minWidth: 0,
    };
    const row = { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 };
    const label = { flex: '0 0 auto', color: C.sub };
    const pill = (active) => ({
      border: `1px solid ${active ? C.accent : C.line}`,
      background: active ? 'rgba(77, 141, 255, .18)' : 'transparent',
      color: active ? C.text : C.sub,
      borderRadius: 999,
      padding: '0 14px',
      minHeight: TAP,
      minWidth: TAP,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      touchAction: 'manipulation',
      cursor: 'pointer',
      font: 'inherit',
    });
    const btn = {
      border: `0.5px solid ${C.line}`,
      background: 'transparent',
      color: C.text,
      borderRadius: 8,
      padding: '0 14px',
      minHeight: TAP,
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      touchAction: 'manipulation',
      cursor: 'pointer',
      font: 'inherit',
    };
    const mono = {
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      color: C.sub,
      overflowWrap: 'anywhere',
      minWidth: 0,
    };
    const area = {
      width: '100%',
      minHeight: 110,
      boxSizing: 'border-box',
      border: `0.5px solid ${C.line}`,
      borderRadius: 8,
      background: 'transparent',
      color: C.text,
      padding: 10,
      fontSize: 16,
      lineHeight: '22px',
      font: 'inherit',
      resize: 'vertical',
    };
    const pre = {
      margin: '8px 0 0',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'anywhere',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 12,
      lineHeight: '18px',
      color: C.sub,
    };

    async function call(path, body) {
      const response = await fetch(`${API}${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data.ok !== true) {
        throw new Error((data && data.error) || `HTTP ${response.status}`);
      }
      return data;
    }

    function ThinkZhPanel() {
      const [snap, setSnap] = useState(null);
      const [error, setError] = useState('');
      const [busy, setBusy] = useState(false);
      const [draft, setDraft] = useState('');
      const [draftLoaded, setDraftLoaded] = useState(false);

      const load = useCallback(async () => {
        setBusy(true);
        try {
          const data = await call('/status');
          setSnap(data);
          setError('');
          if (!draftLoaded) {
            setDraft(data.config?.customText || '');
            setDraftLoaded(true);
          }
        } catch (err) {
          setError(err && err.message ? err.message : String(err));
        } finally {
          setBusy(false);
        }
      }, [draftLoaded]);

      useEffect(() => {
        load();
      }, [load]);

      const send = useCallback(
        async (path, body) => {
          setBusy(true);
          try {
            const data = await call(path, body);
            setSnap(data);
            setError('');
            setDraft(data.config?.customText || '');
            setDraftLoaded(true);
          } catch (err) {
            setError(err && err.message ? err.message : String(err));
          } finally {
            setBusy(false);
          }
        },
        [],
      );

      const cfg = snap?.config;
      const strengths = snap?.strengths || ['soft', 'normal', 'hard', 'max'];
      const strengthLabel = useMemo(
        () => ({ soft: '尽量', normal: '要求', hard: '强制', max: '最严' }),
        [],
      );

      return h(
        'div',
        { style: box },
        h('h2', { style: { margin: 0, fontSize: 17, fontWeight: 600 } }, '中文思考'),
        h(
          'p',
          { style: { margin: 0, color: C.sub } },
          '让模型用简体中文写 thinking / reasoning。注入两层：系统提示最后一段 + 每轮运行时提醒；代码、命令、路径、报错原文不翻译。',
        ),

        error
          ? h('div', { style: { ...card, borderColor: 'var(--dsw-alias-state-error-primary, #e5484d)' } }, `读取失败：${error}`)
          : null,

        !snap && !error ? h('div', { style: { color: C.sub } }, '读取中…') : null,

        cfg
          ? h(
              'div',
              { style: card },
              h(
                'div',
                { style: row },
                h('span', { style: label }, '总开关'),
                h(
                  'button',
                  {
                    style: pill(cfg.enabled === true),
                    disabled: busy,
                    onClick: () => send('/set', { enabled: cfg.enabled !== true }),
                  },
                  cfg.enabled ? '已开启' : '已关闭',
                ),
                h('span', { style: { ...mono, marginLeft: 'auto' } }, snap.overridden ? '运行时覆盖' : '补丁默认值'),
              ),

              h(
                'div',
                { style: row },
                h('span', { style: label }, '强度'),
                ...strengths.map((key) =>
                  h(
                    'button',
                    {
                      key,
                      style: pill(cfg.strength === key),
                      disabled: busy,
                      title: strengthLabel[key] || key,
                      onClick: () => send('/set', { strength: key }),
                    },
                    `${key} · ${strengthLabel[key] || ''}`,
                  ),
                ),
              ),

              h(
                'div',
                { style: row },
                h('span', { style: label }, '每轮提醒'),
                h(
                  'button',
                  { style: pill(cfg.perTurn === true), disabled: busy, onClick: () => send('/set', { perTurn: cfg.perTurn !== true }) },
                  cfg.perTurn ? '开' : '关',
                ),
                h('span', { style: label }, '代码原文'),
                h(
                  'button',
                  {
                    style: pill(cfg.codeVerbatim === true),
                    disabled: busy,
                    onClick: () => send('/set', { codeVerbatim: cfg.codeVerbatim !== true }),
                  },
                  cfg.codeVerbatim ? '不翻译' : '允许翻译',
                ),
              ),
            )
          : null,

        cfg
          ? h(
              'div',
              { style: card },
              h('span', { style: label }, '自定义正文（留空用内置文案）'),
              h('textarea', {
                style: area,
                value: draft,
                placeholder: '留空 = 用四档内置文案。填了就把这段原样当系统提示的最后一段。',
                onChange: (event) => setDraft(event.target.value),
              }),
              h(
                'div',
                { style: row },
                h(
                  'button',
                  { style: btn, disabled: busy, onClick: () => send('/set', { customText: draft }) },
                  draft.trim() ? '保存正文' : '清空正文',
                ),
                h(
                  'button',
                  { style: btn, disabled: busy, onClick: () => send('/reset') },
                  '恢复默认',
                ),
                h('button', { style: btn, disabled: busy, onClick: load }, '刷新'),
                h('span', { style: { ...mono, marginLeft: 'auto' } }, snap.statePath),
              ),
            )
          : null,

        cfg
          ? h(
              'details',
              { style: card },
              h('summary', { style: { cursor: 'pointer', color: C.sub, minHeight: TAP, display: 'flex', alignItems: 'center' } }, '当前注入的系统提示（点开看）'),
              h('pre', { style: pre }, snap.sectionText || '（空：总开关关着，或自定义正文为空）'),
              h('pre', { style: pre }, `每轮提醒：${snap.contextText || '（关）'}`),
            )
          : null,
      );
    }

    return {
      inject: ['slots'],
      apply(ctx) {
        try {
          ctx.slots.inject('settings.plugins.tab', () =>
            ctx.slots.register(
              { name: 'settings.plugins.tab', id: 'think-zh', order: 50, label: '中文思考' },
              ThinkZhPanel,
            ),
          );
          console.info('[think-zh] 已注册设置页「内置插件 → 中文思考」');
        } catch (error) {
          console.warn('[think-zh] 注册设置页失败：' + (error && error.message ? error.message : error));
        }
      },
    };
  },
});
