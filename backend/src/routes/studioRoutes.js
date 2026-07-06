const { Router } = require('express');
const ctrl = require('../controllers/StudioController');

const router = Router();

router.get('/',       ctrl.list);
router.get('/:id',    ctrl.detail);
router.post('/',      ctrl.addStudio);   // POST /api/studios  (别名 add-studio)
router.put('/:id',    ctrl.update);
router.delete('/:id', ctrl.remove);

module.exports = router;
