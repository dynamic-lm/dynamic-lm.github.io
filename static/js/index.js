window.HELP_IMPROVE_VIDEOJS = false;


$(document).ready(function() {
    // Check for click events on the navbar burger icon

    var options = {
			slidesToScroll: 1,
			slidesToShow: 1,
			loop: true,
			infinite: true,
			autoplay: true,
			autoplaySpeed: 5000,
    }

		// Initialize all div with carousel class
    var carousels = bulmaCarousel.attach('.carousel', options);
	
    bulmaSlider.attach();

    var $chartButtons = $('.chart-selector__button');
    if ($chartButtons.length) {
        var $chartFigures = $('.chart-display .chart-figure');
        var activateChart = function(targetId) {
            $chartButtons.attr('aria-pressed', 'false').removeClass('is-active');
            $chartFigures.attr('hidden', true);
            $('#' + targetId).removeAttr('hidden');
        };

        $chartButtons.on('click', function() {
            var $button = $(this);
            var targetId = $button.data('chart-target');
            activateChart(targetId);
            $button.attr('aria-pressed', 'true').addClass('is-active');
        });

        var $initialActive = $chartButtons.filter('.is-active').first();
        if ($initialActive.length) {
            $initialActive.trigger('click');
        } else {
            $chartButtons.first().trigger('click');
        }
    }

    var $examplesToggle = $('#chart-examples-toggle');
    if ($examplesToggle.length) {
        var $examplesPanel = $('#chart-examples');
        $examplesToggle.on('click', function() {
            var expanded = $(this).attr('aria-expanded') === 'true';
            $(this).attr('aria-expanded', (!expanded).toString());
            if (expanded) {
                $examplesPanel.attr('hidden', true);
            } else {
                $examplesPanel.removeAttr('hidden');
            }
        });
    }

})
