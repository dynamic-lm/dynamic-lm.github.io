'use strict';

/* global $, bulmaCarousel, bulmaSlider */

window.HELP_IMPROVE_VIDEOJS = false;

// MathJax configuration moved to index.html

const TARGET_ASPECT = 0.38;
const MIN_HEIGHT = 300;
const MAX_WIDTH = 860;

const initCarousel = () => {
    const container = document.querySelector('.carousel-container');
    const track = container ? container.querySelector('.carousel-track') : null;
    const panels = container ? container.querySelectorAll('.carousel-panel') : [];
    const paginationDots = document.querySelectorAll('.carousel-pagination .pagination-dot');
    const leftArrow = container ? container.querySelector('.carousel-arrow-left') : null;
    const rightArrow = container ? container.querySelector('.carousel-arrow-right') : null;

    if (!container || !track || !leftArrow || !rightArrow || !paginationDots.length || !panels.length) {
        return;
    }

    let currentSlide = 0;
    const totalSlides = Math.max(panels.length, paginationDots.length);

    const getPanelWidth = () => {
        const firstPanel = panels[0];
        if (!firstPanel) {
            return 0;
        }
        const rect = firstPanel.getBoundingClientRect();
        return rect.width || firstPanel.offsetWidth || container.clientWidth;
    };

    const updateTrackWidth = () => {
        const width = getPanelWidth();
        if (!width) {
            return;
        }
        track.style.width = `${width * panels.length}px`;
        panels.forEach((panel) => {
            panel.style.width = `${width}px`;
        });
        return width;
    };

    let panelWidth = updateTrackWidth() || 850;

    const updateCarousel = () => {
        panelWidth = getPanelWidth() || panelWidth;
        const leftPosition = -currentSlide * panelWidth;
        track.style.left = `${leftPosition}px`;

        paginationDots.forEach((dot, index) => {
            dot.style.background = index === currentSlide ? '#000' : '#ccc';
        });
    };

    leftArrow.addEventListener('click', () => {
        currentSlide = (currentSlide - 1 + totalSlides) % totalSlides;
        updateCarousel();
    });

    rightArrow.addEventListener('click', () => {
        currentSlide = (currentSlide + 1) % totalSlides;
        updateCarousel();
    });

    paginationDots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            currentSlide = index;
            updateCarousel();
        });
    });

    let autoPlayInterval;

    const startAutoPlay = () => {
        stopAutoPlay();
        autoPlayInterval = window.setInterval(() => {
            currentSlide = (currentSlide + 1) % totalSlides;
            updateCarousel();
        }, 3000);
    };

    const stopAutoPlay = () => {
        if (autoPlayInterval) {
            window.clearInterval(autoPlayInterval);
            autoPlayInterval = undefined;
        }
    };

    container.addEventListener('mouseenter', stopAutoPlay);
    container.addEventListener('mouseleave', startAutoPlay);

    window.addEventListener('resize', () => {
        panelWidth = updateTrackWidth() || panelWidth;
        updateCarousel();
    }, { passive: true });

    updateCarousel();
    startAutoPlay();
};

const initFloatingTOC = () => {
    const tocLinks = document.querySelectorAll('.toc-link');
    const sections = document.querySelectorAll('section[id]');

    if (!tocLinks.length || !sections.length) {
        return;
    }

    const updateActiveTOCLink = () => {
        let currentSection = '';

        sections.forEach((section) => {
            if (window.scrollY >= section.offsetTop - 200) {
                currentSection = section.id;
            }
        });

        tocLinks.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${currentSection}`);
        });
    };

    window.addEventListener('scroll', updateActiveTOCLink, { passive: true });

    tocLinks.forEach((link) => {
        link.addEventListener('click', (event) => {
            event.preventDefault();
            const targetId = link.getAttribute('href').slice(1);
            const targetSection = document.getElementById(targetId);

            if (targetSection) {
                targetSection.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    updateActiveTOCLink();
};

const showCopySuccess = (button) => {
    const originalHTML = button.innerHTML;
    button.innerHTML = '<span class="icon is-small"><i class="fas fa-check"></i></span><span>Copied!</span>';
    button.style.background = '#d4edda';
    button.style.borderColor = '#c3e6cb';
    button.style.color = '#155724';

    window.setTimeout(() => {
        button.innerHTML = originalHTML;
        button.style.background = '#f8f9fa';
        button.style.borderColor = '#ddd';
        button.style.color = '';
    }, 2000);
};

const fallbackCopy = (text, button) => {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        document.execCommand('copy');
        showCopySuccess(button);
    } catch (error) {
        console.error('Fallback copy failed:', error);
        window.alert('Failed to copy. Please select and copy manually.');
    }

    document.body.removeChild(textArea);
};

const setupBibtexCopy = () => {
    const copyButton = document.getElementById('copy-bibtex');

    if (!copyButton) {
        return;
    }

    const bibtexText = `@misc{wu2025interruptible,
  title={Are Large Reasoning Models Interruptible?},
  author={Wu, Tsung-Han and Miroyan, Mihran and Chan, David M and Darrell, Trevor and Norouzi, Narges and Gonzalez, Joseph E},
  note={Project page},
  year={2025}
}`;

    copyButton.addEventListener('click', (event) => {
        event.preventDefault();

        if (navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(bibtexText).then(() => {
                showCopySuccess(copyButton);
            }).catch((error) => {
                console.error('Clipboard API failed:', error);
                fallbackCopy(bibtexText, copyButton);
            });
            return;
        }

        fallbackCopy(bibtexText, copyButton);
    });
};

const initChartToggles = () => {
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

        window.requestAnimationFrame(() => resizePlot(active));
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

    const examplesToggle = document.getElementById('chart-examples-toggle');
    const examplesContainer = document.getElementById('chart-examples');

    if (examplesToggle && examplesContainer) {
        const examplesFrame = examplesContainer.querySelector('.chart-examples__frame');
        let examplesLoaded = false;

        const updateButtonState = (isOpen) => {
            examplesToggle.setAttribute('aria-expanded', String(isOpen));
            examplesToggle.innerHTML = isOpen
                ? '<span class="chart-examples__icon" aria-hidden="true">✕</span> Hide examples'
                : '<span class="chart-examples__icon" aria-hidden="true">📂</span> See examples';
        };

        updateButtonState(false);

        examplesToggle.addEventListener('click', () => {
            const isCurrentlyOpen = !examplesContainer.hidden;

            if (isCurrentlyOpen) {
                examplesContainer.hidden = true;
                updateButtonState(false);
                return;
            }

            if (!examplesLoaded && examplesFrame && examplesFrame.dataset.src) {
                examplesFrame.src = examplesFrame.dataset.src;
                examplesLoaded = true;
            }

            examplesContainer.hidden = false;
            updateButtonState(true);
        });

        if (examplesFrame) {
            examplesFrame.addEventListener('error', () => {
                if (examplesFrame.dataset.src) {
                    window.open(examplesFrame.dataset.src, '_blank', 'noopener');
                }
            });
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    initFloatingTOC();
    setupBibtexCopy();
    initChartToggles();
});

$(document).ready(() => {
    const options = {
        slidesToScroll: 1,
        slidesToShow: 1,
        loop: true,
        infinite: true,
        autoplay: true,
        autoplaySpeed: 5000
    };

    bulmaCarousel.attach('.carousel', options);
    bulmaSlider.attach();

    const $chartButtons = $('.chart-selector__button');
    if ($chartButtons.length) {
        const $chartFigures = $('.chart-display .chart-figure');
        const activateChart = (targetId) => {
            $chartButtons.attr('aria-pressed', 'false').removeClass('is-active');
            $chartFigures.attr('hidden', true);
            $(`#${targetId}`).removeAttr('hidden');
        };

        $chartButtons.on('click', function onChartClick() {
            const $button = $(this);
            const targetId = $button.data('chart-target');
            activateChart(targetId);
            $button.attr('aria-pressed', 'true').addClass('is-active');
        });

        const $initialActive = $chartButtons.filter('.is-active').first();
        if ($initialActive.length) {
            $initialActive.trigger('click');
        } else {
            $chartButtons.first().trigger('click');
        }
    }

    const $examplesToggle = $('#chart-examples-toggle');
    if ($examplesToggle.length) {
        const $examplesPanel = $('#chart-examples');
        $examplesToggle.on('click', function onExamplesToggle() {
            const expanded = $(this).attr('aria-expanded') === 'true';
            $(this).attr('aria-expanded', (!expanded).toString());
            if (expanded) {
                $examplesPanel.attr('hidden', true);
            } else {
                $examplesPanel.removeAttr('hidden');
            }
        });
    }

    // Dataset viewer toggle functionality
    function initDatasetToggle() {
        const datasetBtns = document.querySelectorAll('.dataset-btn');
        const datasetIframes = document.querySelectorAll('.dataset-iframe');
        
        if (datasetBtns.length === 0 || datasetIframes.length === 0) {
            return; // Elements not found yet
        }

        const forceLightTheme = () => {
            datasetIframes.forEach((iframe) => {
                const srcAttr = iframe.getAttribute('src');
                const pendingSrc = iframe.dataset.src;
                const targetSrc = srcAttr || pendingSrc;

                if (!targetSrc) {
                    return;
                }

                try {
                    const url = new URL(targetSrc, window.location.href);
                    if (url.searchParams.get('theme') !== 'light') {
                        url.searchParams.set('theme', 'light');
                        const updatedSrc = url.toString();

                        if (srcAttr) {
                            iframe.setAttribute('src', updatedSrc);
                        }

                        if (pendingSrc) {
                            iframe.dataset.src = updatedSrc;
                        }
                    }
                } catch (error) {
                    console.warn('Unable to enforce dataset theme', error);
                }
            });
        };

        forceLightTheme();
        
        datasetBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const selectedDataset = this.getAttribute('data-dataset');
                
                // Update button states
                datasetBtns.forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                
                // Update iframe visibility
                datasetIframes.forEach(iframe => {
                    iframe.classList.remove('active');
                    if (iframe.getAttribute('data-dataset') === selectedDataset) {
                        iframe.classList.add('active');
                    }
                });
            });
        });
    }
    
    // Initialize dataset toggle
    initDatasetToggle();
});
