const TARGET_ASPECT = 0.38;
const MIN_HEIGHT = 300;
const MAX_WIDTH = 860;

document.addEventListener('DOMContentLoaded', () => {
    const buttons = document.querySelectorAll('[data-chart-toggle]');
    const frames = document.querySelectorAll('[data-chart]');

    if (!buttons.length || !frames.length) {
        return;
    }

    const getFrameMetrics = (frame) => {
        const parent = frame.parentElement;
        const parentWidth = parent ? parent.clientWidth : 0;
        const rectWidth = frame.getBoundingClientRect().width;
        const width = Math.min(Math.max(rectWidth, parentWidth), MAX_WIDTH);

        if (!width) {
            return null;
        }

        const height = Math.max(MIN_HEIGHT, Math.round(width * TARGET_ASPECT));
        return { width, height };
    };

    const resizePlot = (frame) => {
        const metrics = getFrameMetrics(frame);

        if (!metrics) {
            return;
        }

        frame.style.width = '100%';
        frame.style.height = `${metrics.height}px`;

        try {
            const doc = frame.contentDocument;
            const plotDiv = doc ? doc.querySelector('.plotly-graph-div') : null;

            if (!plotDiv) {
                return;
            }

            plotDiv.style.width = `${metrics.width}px`;
            plotDiv.style.maxWidth = '100%';
            plotDiv.style.margin = '0 auto';

            const plotly = frame.contentWindow && frame.contentWindow.Plotly;

            if (plotly && typeof plotly.relayout === 'function') {
                plotly.relayout(plotDiv, {
                    width: metrics.width,
                    height: metrics.height
                });

                if (plotly.Plots && typeof plotly.Plots.resize === 'function') {
                    plotly.Plots.resize(plotDiv);
                }
            }
        } catch (error) {
            console.warn('Unable to resize Plotly chart', error);
        }
    };

    const resizeActiveFrame = () => {
        const active = Array.from(frames).find((frame) => !frame.hasAttribute('hidden'));

        if (!active) {
            return;
        }

        requestAnimationFrame(() => resizePlot(active));
    };

    const activate = (chartId) => {
        buttons.forEach((button) => {
            const isActive = button.getAttribute('data-chart-toggle') === chartId;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });

        frames.forEach((frame) => {
            const isActive = frame.getAttribute('data-chart') === chartId;

            if (isActive) {
                frame.removeAttribute('hidden');
            } else {
                frame.setAttribute('hidden', '');
            }
        });

        resizeActiveFrame();
    };

    buttons.forEach((button) => {
        button.addEventListener('click', () => {
            activate(button.getAttribute('data-chart-toggle'));
        });
    });

    frames.forEach((frame) => {
        frame.addEventListener('load', () => {
            frame.dataset.chartLoaded = 'true';

            if (!frame.hasAttribute('hidden')) {
                resizePlot(frame);
            }
        });
    });

    window.addEventListener('resize', resizeActiveFrame);

    activate(buttons[0].getAttribute('data-chart-toggle'));
    resizeActiveFrame();
});
