<?php
/**
 * Workflow GUI Pimcore Plugin
 *
 * LICENSE
 *
 * This source file is subject to the GNU General Public License version 3 (GPLv3)
 * For the full copyright and license information, please view the LICENSE.md and gpl-3.0.txt
 * files that are distributed with this source code.
 *
 * @copyright  Copyright (c) 2015-2018 Dominik Pfaffenbauer (https://www.pfaffenbauer.at)
 * @license    https://github.com/dpfaffenbauer/pimcore-WorkflowGui/blob/master/LICENSE.md     GNU General Public License version 3 (GPLv3)
 */

namespace WorkflowGuiBundle;

use Pimcore\Extension\Bundle\AbstractPimcoreBundle;
use Pimcore\Extension\Bundle\Traits\PackageVersionTrait;
use Symfony\Component\DependencyInjection\ContainerBuilder;
use WorkflowGuiBundle\Compiler\WorkflowPass;

/**
 * Class WorkflowGuiBundle
 * @package WorkflowGuiBundle
 */
class WorkflowGuiBundle extends AbstractPimcoreBundle
{
    use PackageVersionTrait;

    /**
     * @return string
     */
    protected function getComposerPackageName(): string
    {
        return 'dpfaffenbauer/workflow-gui';
    }

    /**
     * @return array|\Pimcore\Routing\RouteReferenceInterface[]|string[]
     */
    public function getJsPaths()
    {
        return [
            '/bundles/workflowgui/js/startup.js',
            '/bundles/workflowgui/js/workflow/panel.js',
            '/bundles/workflowgui/js/workflow/item.js',
            '/bundles/workflowgui/js/workflow/validation.js',
        ];
    }

    /**
     * @return array|\Pimcore\Routing\RouteReferenceInterface[]|string[]
     */
    public function getCssPaths()
    {
        return [
            '/bundles/workflowgui/css/workflow.css'
        ];
    }

    /**
     * @param ContainerBuilder $container
     */
    public function build(ContainerBuilder $container) {
        $container->addCompilerPass(new WorkflowPass());
        parent::build($container);
    }
}
